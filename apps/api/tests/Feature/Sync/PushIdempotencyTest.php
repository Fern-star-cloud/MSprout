<?php

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
    $this->deviceId = (string) Str::uuid();
    $this->batchId = (string) Str::uuid();
    $this->sessionId = (string) Str::uuid();
    $this->eventId = (string) Str::uuid();
    $this->studentIds = collect(['Ana', 'Ben'])->map(function (string $name): string {
        $studentId = (string) Str::uuid();
        DB::connection('pgsql_migration')->table('students')->insert([
            'id' => $studentId,
            'church_id' => $this->church->id,
            'first_name' => $name,
            'last_name' => 'Sprout',
            'gender' => 'unspecified',
            'version' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::connection('pgsql_migration')->table('enrollments')->insert([
            'id' => (string) Str::uuid(),
            'church_id' => $this->church->id,
            'student_id' => $studentId,
            'ministry_id' => $this->ministryId,
            'version' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $studentId;
    })->all();
    grantSyncDevice($this->ownerMembership->id, $this->church->id, $this->deviceId);
});

function grantSyncDevice(string $membershipId, string $churchId, string $deviceId): void
{
    DB::connection('pgsql_migration')->table('offline_authorizations')->insert([
        'id' => (string) Str::uuid(),
        'church_id' => $churchId,
        'membership_id' => $membershipId,
        'device_id' => $deviceId,
        'expires_at' => now()->addDays(14),
    ]);
}

function draftCreatedEvent(object $test): array
{
    return [
        'client_event_id' => $test->eventId,
        'entity_id' => $test->sessionId,
        'action' => 'attendance.draft_created',
        'base_version' => 0,
        'occurred_at' => '2026-09-29T01:00:00Z',
        'payload' => [
            'ministry_id' => $test->ministryId,
            'attendance_date' => '2026-09-29',
            'student_ids' => $test->studentIds,
        ],
    ];
}

function pushSyncEvent(object $test, array $events, ?string $batchId = null)
{
    return $test->postJson('/api/sync/push', [
        'device_id' => $test->deviceId,
        'batch_id' => $batchId ?? $test->batchId,
        'events' => $events,
    ]);
}

it('stores an accepted event atomically and returns the original acknowledgement on replay', function (): void {
    $event = draftCreatedEvent($this);

    $first = pushSyncEvent($this, [$event])->assertOk();
    $retry = pushSyncEvent($this, [$event], (string) Str::uuid())->assertOk();

    $first->assertJsonPath('results.0.status', 'accepted')
        ->assertJsonPath('results.0.client_event_id', $this->eventId)
        ->assertJsonPath('results.0.record_id', $this->sessionId)
        ->assertJsonPath('results.0.version', 1);
    $retry->assertJsonPath('results.0.status', 'duplicate')
        ->assertJsonPath('results.0.original_status', 'accepted')
        ->assertJsonPath('results.0.record_id', $this->sessionId)
        ->assertJsonPath('results.0.version', 1);

    $db = DB::connection('pgsql_migration');
    expect($db->table('attendance_sessions')->where('id', $this->sessionId)->count())->toBe(1)
        ->and($db->table('attendance_records')->where('attendance_session_id', $this->sessionId)->count())->toBe(2)
        ->and($db->table('sync_events')->where('client_event_id', $this->eventId)->count())->toBe(1)
        ->and($db->table('change_feed')->where('entity_id', $this->sessionId)->count())->toBe(1)
        ->and($db->table('audit_events')->where('action', 'attendance.draft_created')->count())->toBe(1);
});

it('finishes one authoritative attendance outcome when a committed batch is retried', function (): void {
    $events = [draftCreatedEvent($this)];
    $versions = [1, 2];
    foreach ($this->studentIds as $index => $studentId) {
        $events[] = [
            'client_event_id' => (string) Str::uuid(),
            'entity_id' => $this->sessionId,
            'action' => 'attendance.student_marked',
            'base_version' => $versions[$index],
            'occurred_at' => '2026-09-29T01:00:0'.($index + 1).'Z',
            'payload' => ['student_id' => $studentId, 'state' => $index === 0 ? 'present' : 'absent'],
        ];
    }
    $events[] = [
        'client_event_id' => (string) Str::uuid(),
        'entity_id' => $this->sessionId,
        'action' => 'attendance.finalized',
        'base_version' => 3,
        'occurred_at' => '2026-09-29T01:00:03Z',
        'payload' => [],
    ];

    pushSyncEvent($this, $events)->assertOk()->assertJsonCount(4, 'results');
    pushSyncEvent($this, $events)->assertOk()
        ->assertJsonPath('results.0.status', 'duplicate')
        ->assertJsonPath('results.3.status', 'duplicate');

    $db = DB::connection('pgsql_migration');
    expect($db->table('attendance_sessions')->where('id', $this->sessionId)->value('status'))->toBe('finalized')
        ->and($db->table('attendance_sessions')->where('id', $this->sessionId)->value('version'))->toBe(4)
        ->and($db->table('sync_events')->where('device_id', $this->deviceId)->count())->toBe(4)
        ->and($db->table('change_feed')->where('entity_id', $this->sessionId)->count())->toBe(4)
        ->and($db->table('audit_events')->where('action', 'attendance.finalized')->count())->toBe(1);
});

it('rejects a mismatched replay and prevents another actor from claiming the receipt', function (): void {
    $event = draftCreatedEvent($this);
    pushSyncEvent($this, [$event])->assertOk();

    $mismatch = $event;
    $mismatch['payload']['attendance_date'] = '2026-09-30';
    pushSyncEvent($this, [$mismatch])->assertOk()
        ->assertJsonPath('results.0.status', 'rejected')
        ->assertJsonPath('results.0.reason', 'event_mismatch');

    [$teacher, $membership] = ChurchScenario::teacher($this->church);
    DB::connection('pgsql_migration')->table('teacher_ministry_assignments')->insert([
        'id' => (string) Str::uuid(), 'church_id' => $this->church->id, 'membership_id' => $membership->id,
        'ministry_id' => $this->ministryId, 'assigned_by' => $this->owner->id, 'created_at' => now(), 'updated_at' => now(),
    ]);
    grantSyncDevice($membership->id, $this->church->id, $this->deviceId);
    $teacher = User::findOrFail($teacher->id);
    $this->actingAs($teacher, 'web')->withSession(['password_hash_web' => $teacher->getAuthPassword()]);

    pushSyncEvent($this, [$event])->assertOk()
        ->assertJsonPath('results.0.status', 'rejected')
        ->assertJsonPath('results.0.reason', 'event_claim_mismatch');

    expect(DB::connection('pgsql_migration')->table('sync_events')->where('client_event_id', $this->eventId)->count())->toBe(1)
        ->and(DB::connection('pgsql_migration')->table('audit_events')->where('action', 'sync.event.rejected')->count())->toBe(2);
});

it('keeps replay keys tenant-local when device and event UUIDs are reused', function (): void {
    pushSyncEvent($this, [draftCreatedEvent($this)])->assertOk();
    [$foreignOwner, $foreignChurch] = ChurchScenario::owner();

    DB::connection('pgsql_migration')->table('sync_events')->insert([
        'id' => (string) Str::uuid(),
        'church_id' => $foreignChurch->id,
        'device_id' => $this->deviceId,
        'client_event_id' => $this->eventId,
        'batch_id' => (string) Str::uuid(),
        'actor_id' => $foreignOwner->id,
        'payload_hash' => str_repeat('b', 64),
        'result_status' => 'rejected',
        'result_reason' => 'record_not_found',
        'received_at' => now(),
        'correlation_id' => (string) Str::uuid(),
    ]);

    expect(DB::connection('pgsql_migration')->table('sync_events')
        ->where('device_id', $this->deviceId)
        ->where('client_event_id', $this->eventId)
        ->count())->toBe(2);
});

it('records version conflicts and rejects stale membership or device authorization', function (): void {
    pushSyncEvent($this, [draftCreatedEvent($this)])->assertOk();
    $stale = [
        'client_event_id' => (string) Str::uuid(),
        'entity_id' => $this->sessionId,
        'action' => 'attendance.student_marked',
        'base_version' => 0,
        'occurred_at' => '2026-09-29T01:01:00Z',
        'payload' => ['student_id' => $this->studentIds[0], 'state' => 'present'],
    ];
    pushSyncEvent($this, [$stale])->assertOk()
        ->assertJsonPath('results.0.status', 'conflict')
        ->assertJsonPath('results.0.reason', 'version_conflict')
        ->assertJsonPath('results.0.version', 1);

    DB::connection('pgsql_migration')->table('offline_authorizations')->where('device_id', $this->deviceId)->update(['revoked_at' => now()]);
    $unauthorized = $stale;
    $unauthorized['client_event_id'] = (string) Str::uuid();
    pushSyncEvent($this, [$unauthorized])->assertForbidden();

    [$teacher, $membership] = ChurchScenario::teacher($this->church);
    $teacherDevice = (string) Str::uuid();
    grantSyncDevice($membership->id, $this->church->id, $teacherDevice);
    $teacher = User::findOrFail($teacher->id);
    $this->actingAs($teacher, 'web')->withSession(['password_hash_web' => $teacher->getAuthPassword()]);
    DB::connection('pgsql_migration')->table('church_memberships')->where('id', $membership->id)->update(['status' => 'revoked']);
    $this->deviceId = $teacherDevice;
    pushSyncEvent($this, [$unauthorized])->assertForbidden();
});
