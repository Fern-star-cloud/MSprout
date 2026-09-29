<?php

use App\Models\AttendanceRevision;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\ChurchScenario;
use Tests\Support\MembershipScenario;
use Tests\Support\PostgresTestDatabase;

beforeEach(function (): void {
    PostgresTestDatabase::refresh();
    [$this->owner, $this->church, $this->ownerMembership] = MembershipScenario::owner($this);
    $this->ministryId = MembershipScenario::ministry($this->church->id);
    [$teacher, $this->teacherMembership] = ChurchScenario::teacher($this->church);
    $this->teacher = User::findOrFail($teacher->id);
    DB::connection('pgsql_migration')->table('teacher_ministry_assignments')->insert([
        'id' => (string) Str::uuid(), 'church_id' => $this->church->id,
        'membership_id' => $this->teacherMembership->id, 'ministry_id' => $this->ministryId,
        'assigned_by' => $this->owner->id, 'created_at' => now(), 'updated_at' => now(),
    ]);
    $this->deviceId = (string) Str::uuid();
    DB::connection('pgsql_migration')->table('offline_authorizations')->insert([
        'id' => (string) Str::uuid(), 'church_id' => $this->church->id,
        'membership_id' => $this->ownerMembership->id, 'device_id' => $this->deviceId,
        'expires_at' => now()->addDays(14),
    ]);
    $this->studentIds = collect(['Ana', 'Ben'])->map(function (string $name): string {
        $id = (string) Str::uuid();
        DB::connection('pgsql_migration')->table('students')->insert([
            'id' => $id, 'church_id' => $this->church->id, 'first_name' => $name,
            'last_name' => 'Sprout', 'gender' => 'unspecified', 'version' => 1,
            'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::connection('pgsql_migration')->table('enrollments')->insert([
            'id' => (string) Str::uuid(), 'church_id' => $this->church->id,
            'student_id' => $id, 'ministry_id' => $this->ministryId, 'version' => 1,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        return $id;
    })->all();
    $this->sessionId = (string) Str::uuid();
});

function task14Push(object $test, array $events)
{
    return $test->postJson('/api/sync/push', [
        'device_id' => $test->deviceId,
        'batch_id' => (string) Str::uuid(),
        'events' => $events,
    ]);
}

function task14Event(object $test, string $action, int $baseVersion, array $payload, ?string $eventId = null): array
{
    return [
        'client_event_id' => $eventId ?? (string) Str::uuid(),
        'entity_id' => $test->sessionId,
        'action' => $action,
        'base_version' => $baseVersion,
        'occurred_at' => '2026-09-29T02:03:04Z',
        'payload' => $payload,
    ];
}

function task14CreateDraft(object $test): void
{
    task14Push($test, [task14Event($test, 'attendance.draft_created', 0, [
        'ministry_id' => $test->ministryId,
        'attendance_date' => '2026-09-29',
        'student_ids' => $test->studentIds,
    ])])->assertOk()->assertJsonPath('results.0.status', 'accepted');
}

it('deduplicates identical values, merges non-overlapping stale changes, and preserves contradictions for review', function (): void {
    task14CreateDraft($this);

    task14Push($this, [task14Event($this, 'attendance.student_marked', 1, [
        'student_id' => $this->studentIds[0], 'state' => 'present',
    ])])->assertOk()->assertJsonPath('results.0.version', 2);

    task14Push($this, [task14Event($this, 'attendance.student_marked', 99, [
        'student_id' => $this->studentIds[0], 'state' => 'present',
    ])])->assertOk()->assertJsonPath('results.0.status', 'conflict')
        ->assertJsonPath('results.0.reason', 'version_conflict')
        ->assertJsonPath('results.0.version', 2);

    task14Push($this, [task14Event($this, 'attendance.student_marked', 1, [
        'student_id' => $this->studentIds[1], 'state' => 'absent',
    ])])->assertOk()->assertJsonPath('results.0.status', 'accepted')->assertJsonPath('results.0.version', 3);

    task14Push($this, [task14Event($this, 'attendance.student_marked', 1, [
        'student_id' => $this->studentIds[0], 'state' => 'present',
    ])])->assertOk()->assertJsonPath('results.0.status', 'accepted')->assertJsonPath('results.0.version', 3);

    $conflictingEvent = task14Event($this, 'attendance.student_marked', 1, [
        'student_id' => $this->studentIds[0], 'state' => 'absent',
    ]);
    task14Push($this, [$conflictingEvent])->assertOk()
        ->assertJsonPath('results.0.status', 'conflict')
        ->assertJsonPath('results.0.reason', 'attendance_conflict')
        ->assertJsonPath('results.0.version', 4);

    $db = DB::connection('pgsql_migration');
    $conflict = $db->table('sync_conflicts')->where('incoming_event_id', $conflictingEvent['client_event_id'])->first();
    expect($db->table('attendance_records')->where('attendance_session_id', $this->sessionId)->where('student_id', $this->studentIds[0])->value('state'))->toBe('present')
        ->and($db->table('attendance_sessions')->where('id', $this->sessionId)->value('status'))->toBe('needs_review')
        ->and($conflict)->not->toBeNull()
        ->and($conflict->field)->toBe('state')
        ->and(json_decode($conflict->existing_value, true))->toBe(['state' => 'present'])
        ->and(json_decode($conflict->incoming_value, true))->toBe(['state' => 'absent'])
        ->and($conflict->incoming_actor_id)->toBe($this->owner->id)
        ->and($conflict->incoming_device_id)->toBe($this->deviceId)
        ->and($conflict->incoming_correlation_id)->not->toBeNull();
});

it('allows only the Owner to inspect and resolve a conflict through an immutable revision', function (): void {
    task14CreateDraft($this);
    task14Push($this, [task14Event($this, 'attendance.student_marked', 1, [
        'student_id' => $this->studentIds[0], 'state' => 'present',
    ])])->assertOk();
    task14Push($this, [
        task14Event($this, 'attendance.student_marked', 2, [
            'student_id' => $this->studentIds[1], 'state' => 'absent',
        ]),
        task14Event($this, 'attendance.finalized', 3, []),
    ])->assertOk();
    task14Push($this, [task14Event($this, 'attendance.student_marked', 1, [
        'student_id' => $this->studentIds[0], 'state' => 'absent',
    ])])->assertOk()->assertJsonPath('results.0.status', 'conflict');
    $conflictId = DB::connection('pgsql_migration')->table('sync_conflicts')->value('id');

    [$unassignedTeacher] = ChurchScenario::teacher($this->church);
    $unassignedTeacher = User::findOrFail($unassignedTeacher->id);
    $this->actingAs($unassignedTeacher, 'web')->withSession(['password_hash_web' => $unassignedTeacher->getAuthPassword()]);
    $this->getJson('/api/sync-conflicts')->assertOk()
        ->assertExactJson(['needs_owner_review' => false]);

    $this->actingAs($this->teacher, 'web')->withSession(['password_hash_web' => $this->teacher->getAuthPassword()]);
    $this->getJson('/api/sync-conflicts')->assertOk()
        ->assertExactJson(['needs_owner_review' => true]);
    $this->getJson('/api/sync-conflicts/'.$conflictId)->assertForbidden();
    $this->postJson('/api/sync-conflicts/'.$conflictId.'/resolve', [
        'choice' => 'incoming', 'reason' => 'Confirmed against the signed paper roster.',
    ])->assertForbidden();

    $this->actingAs($this->owner, 'web')->withSession([
        'church_mfa_user_id' => $this->owner->id,
        'password_hash_web' => $this->owner->getAuthPassword(),
    ]);
    $this->getJson('/api/sync-conflicts')->assertOk()->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.existing.value.state', 'present')
        ->assertJsonPath('data.0.incoming.value.state', 'absent');
    $this->postJson('/api/sync-conflicts/'.$conflictId.'/resolve', [
        'choice' => 'incoming', 'reason' => 'Confirmed against the signed paper roster.',
    ])->assertOk()->assertJsonPath('status', 'resolved')->assertJsonPath('effective_state', 'absent');

    $db = DB::connection('pgsql_migration');
    $record = $db->table('attendance_records')->where('attendance_session_id', $this->sessionId)->where('student_id', $this->studentIds[0])->first();
    $revision = $db->table('attendance_revisions')->where('sync_conflict_id', $conflictId)->first();
    expect($record->state)->toBe('present')
        ->and($revision->before_state)->toBe('present')
        ->and($revision->after_state)->toBe('absent')
        ->and($revision->original_actor_id)->toBe($this->owner->id)
        ->and($revision->resolving_actor_id)->toBe($this->owner->id)
        ->and($revision->reason)->toBe('Confirmed against the signed paper roster.')
        ->and($db->table('attendance_sessions')->where('id', $this->sessionId)->value('status'))->toBe('revised')
        ->and($db->table('audit_events')->where('action', 'attendance.conflict.resolved')->count())->toBe(1);

    $revisionModel = AttendanceRevision::on('pgsql_migration')->findOrFail($revision->id);
    expect(fn () => $revisionModel->forceFill(['reason' => 'Changed later.'])->save())
        ->toThrow(LogicException::class, 'Attendance revisions are append-only.');
});

it('creates Owner-only corrections without mutating the original attendance value or actor', function (): void {
    task14CreateDraft($this);
    task14Push($this, [
        task14Event($this, 'attendance.student_marked', 1, ['student_id' => $this->studentIds[0], 'state' => 'present']),
        task14Event($this, 'attendance.student_marked', 2, ['student_id' => $this->studentIds[1], 'state' => 'absent']),
        task14Event($this, 'attendance.finalized', 3, []),
    ])->assertOk();
    $record = DB::connection('pgsql_migration')->table('attendance_records')->where('attendance_session_id', $this->sessionId)->where('student_id', $this->studentIds[0])->first();

    $this->postJson('/api/attendance-sessions/'.$this->sessionId.'/records/'.$record->id.'/corrections', [
        'state' => 'absent', 'reason' => 'Owner verified the correction.',
    ])->assertOk()->assertJsonPath('effective_state', 'absent');

    $after = DB::connection('pgsql_migration')->table('attendance_records')->where('id', $record->id)->first();
    $revision = DB::connection('pgsql_migration')->table('attendance_revisions')->where('attendance_record_id', $record->id)->first();
    expect($after->state)->toBe('present')
        ->and($after->recorded_by)->toBe($record->recorded_by)
        ->and($revision->before_state)->toBe('present')
        ->and($revision->after_state)->toBe('absent');
});

it('keeps a session in review until every conflict is resolved and preserves its finalized lineage', function (): void {
    task14CreateDraft($this);
    task14Push($this, [
        task14Event($this, 'attendance.student_marked', 1, ['student_id' => $this->studentIds[0], 'state' => 'present']),
        task14Event($this, 'attendance.student_marked', 2, ['student_id' => $this->studentIds[1], 'state' => 'present']),
        task14Event($this, 'attendance.finalized', 3, []),
    ])->assertOk();
    task14Push($this, [task14Event($this, 'attendance.student_marked', 1, [
        'student_id' => $this->studentIds[0], 'state' => 'absent',
    ])])->assertOk()->assertJsonPath('results.0.status', 'conflict');
    task14Push($this, [task14Event($this, 'attendance.student_marked', 1, [
        'student_id' => $this->studentIds[1], 'state' => 'absent',
    ])])->assertOk()->assertJsonPath('results.0.status', 'conflict');

    $conflicts = DB::connection('pgsql_migration')->table('sync_conflicts')->orderBy('created_at')->orderBy('id')->pluck('id');
    $this->actingAs($this->owner, 'web')->withSession([
        'church_mfa_user_id' => $this->owner->id,
        'password_hash_web' => $this->owner->getAuthPassword(),
    ]);
    $this->postJson('/api/sync-conflicts/'.$conflicts[0].'/resolve', [
        'choice' => 'existing', 'reason' => 'Verified the first roster entry.',
    ])->assertOk();
    expect(DB::connection('pgsql_migration')->table('attendance_sessions')->where('id', $this->sessionId)->value('status'))
        ->toBe('needs_review');

    $this->postJson('/api/sync-conflicts/'.$conflicts[1].'/resolve', [
        'choice' => 'incoming', 'reason' => 'Verified the second roster entry.',
    ])->assertOk();
    expect(DB::connection('pgsql_migration')->table('attendance_sessions')->where('id', $this->sessionId)->value('status'))
        ->toBe('revised');
});
