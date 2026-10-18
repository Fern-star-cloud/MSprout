<?php

use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\ChurchScenario;
use Tests\Support\MembershipScenario;
use Tests\Support\PersistedChurchSession;
use Tests\Support\PostgresTestDatabase;

beforeEach(function (): void {
    PostgresTestDatabase::refresh();
    [$this->owner, $this->church] = MembershipScenario::owner($this);
    $this->ministryId = MembershipScenario::ministry($this->church->id);
    DB::connection('pgsql_migration')->table('ministries')->where('id', $this->ministryId)->update(['name' => '+Primary']);
});

function reportStudent(object $test, string $name): string
{
    $id = (string) Str::uuid();
    DB::connection('pgsql_migration')->table('students')->insert([
        'id' => $id, 'church_id' => $test->church->id, 'first_name' => 'Student',
        'last_name' => 'Sprout', 'preferred_name' => $name, 'gender' => 'unspecified', 'version' => 1,
        'created_at' => now(), 'updated_at' => now(),
    ]);

    return $id;
}

function reportSession(object $test, string $date, string $status, array $states, ?string $ministryId = null): string
{
    $db = DB::connection('pgsql_migration');
    $sessionId = (string) Str::uuid();
    $finalized = in_array($status, ['finalized', 'revised', 'needs_review'], true);
    $db->table('attendance_sessions')->insert([
        'id' => $sessionId, 'church_id' => $test->church->id,
        'ministry_id' => $ministryId ?? $test->ministryId, 'attendance_date' => $date,
        'status' => $status, 'version' => 1,
        'finalized_by' => $finalized ? $test->owner->id : null,
        'finalized_at' => $finalized ? now() : null,
        'created_at' => now(), 'updated_at' => now(),
    ]);
    foreach ($states as $studentId => $state) {
        $db->table('attendance_records')->insert([
            'id' => (string) Str::uuid(), 'church_id' => $test->church->id,
            'attendance_session_id' => $sessionId, 'student_id' => $studentId,
            'state' => $state, 'version' => 1, 'recorded_by' => $test->owner->id,
            'recorded_at' => now(), 'recorded_received_at' => now(),
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    return $sessionId;
}

it('reports revision-effective finalized totals without counting pending or unresolved work', function (): void {
    $present = reportStudent($this, 'Present Child');
    $absent = reportStudent($this, 'Absent Child');
    $corrected = reportStudent($this, 'Corrected Child');
    $pending = reportStudent($this, 'Pending Child');
    $sessionId = reportSession($this, '2026-09-20', 'finalized', [
        $present => 'present', $absent => 'absent', $corrected => 'absent',
    ]);
    $record = DB::connection('pgsql_migration')->table('attendance_records')
        ->where('attendance_session_id', $sessionId)->where('student_id', $corrected)->first();
    DB::connection('pgsql_migration')->table('attendance_revisions')->insert([
        'id' => (string) Str::uuid(), 'church_id' => $this->church->id,
        'attendance_session_id' => $sessionId, 'attendance_record_id' => $record->id,
        'before_state' => 'absent', 'after_state' => 'present',
        'original_actor_id' => $this->owner->id, 'resolving_actor_id' => $this->owner->id,
        'reason' => 'Verified against the paper roster.', 'revised_at' => now(),
        'created_at' => now(), 'updated_at' => now(),
    ]);
    reportSession($this, '2026-09-21', 'draft', [$pending => 'present']);
    $reviewSession = reportSession($this, '2026-09-22', 'needs_review', [$pending => 'present']);
    $reviewRecord = DB::connection('pgsql_migration')->table('attendance_records')->where('attendance_session_id', $reviewSession)->first();
    DB::connection('pgsql_migration')->table('sync_conflicts')->insert([
        'id' => (string) Str::uuid(), 'church_id' => $this->church->id,
        'attendance_session_id' => $reviewSession, 'attendance_record_id' => $reviewRecord->id,
        'incoming_event_id' => (string) Str::uuid(), 'field' => 'state', 'base_version' => 1,
        'existing_value' => json_encode(['state' => 'present']), 'incoming_value' => json_encode(['state' => 'absent']),
        'existing_actor_id' => $this->owner->id, 'incoming_actor_id' => $this->owner->id,
        'incoming_device_id' => (string) Str::uuid(), 'incoming_correlation_id' => (string) Str::uuid(),
        'incoming_occurred_at' => now(), 'incoming_received_at' => now(), 'was_finalized' => true,
        'status' => 'open', 'created_at' => now(), 'updated_at' => now(),
    ]);

    $this->getJson('/api/attendance-reports?date_from=2026-09-01&date_to=2026-09-30&ministry_id='.$this->ministryId)
        ->assertOk()
        ->assertJsonPath('data.role', 'owner')
        ->assertJsonPath('data.can_export', true)
        ->assertJsonPath('data.summary.present_count', 2)
        ->assertJsonPath('data.summary.absent_count', 1)
        ->assertJsonPath('data.summary.finalized_record_count', 3)
        ->assertJsonPath('data.summary.attendance_rate', 2 / 3)
        ->assertJsonPath('data.summary.pending_count', 1)
        ->assertJsonPath('data.summary.conflict_count', 1)
        ->assertJsonPath('data.summary.correction_count', 1)
        ->assertJsonCount(1, 'data.sessions')
        ->assertJsonPath('data.sessions.0.id', $sessionId)
        ->assertJsonPath('data.sessions.0.present_count', 2)
        ->assertJsonPath('data.sessions.0.absent_count', 1);
});

it('limits Teachers to current assigned ministry sessions and denies export', function (): void {
    [$teacher, $membership] = ChurchScenario::teacher($this->church);
    $teacher = User::findOrFail($teacher->id);
    $otherMinistry = MembershipScenario::ministry($this->church->id);
    DB::connection('pgsql_migration')->table('teacher_ministry_assignments')->insert([
        'id' => (string) Str::uuid(), 'church_id' => $this->church->id,
        'membership_id' => $membership->id, 'ministry_id' => $this->ministryId,
        'assigned_by' => $this->owner->id, 'created_at' => now(), 'updated_at' => now(),
    ]);
    $student = reportStudent($this, 'Assigned Child');
    $visible = reportSession($this, '2026-09-20', 'finalized', [$student => 'present']);
    reportSession($this, '2026-09-21', 'finalized', [$student => 'absent'], $otherMinistry);

    PersistedChurchSession::authenticate($this, $teacher, 'web')->withHeader('X-Church-Id', $this->church->id);
    $this->getJson('/api/attendance-reports?date_from=2026-09-01&date_to=2026-09-30')
        ->assertOk()
        ->assertJsonPath('data.role', 'teacher')
        ->assertJsonPath('data.can_export', false)
        ->assertJsonPath('data.summary.present_count', 1)
        ->assertJsonPath('data.summary.absent_count', 0)
        ->assertJsonCount(1, 'data.sessions')
        ->assertJsonPath('data.sessions.0.id', $visible);
    $this->get('/api/attendance-reports/export?date_from=2026-09-01&date_to=2026-09-30', ['Accept' => 'text/csv'])
        ->assertForbidden();
});

it('exports audited UTF-8 CSV with ISO dates and spreadsheet-safe text cells', function (): void {
    $student = reportStudent($this, '=2+3,"run"');
    reportSession($this, '2026-09-20', 'finalized', [$student => 'present']);
    $correlation = (string) Str::uuid();

    $response = $this->withHeader('X-Correlation-Id', $correlation)
        ->get('/api/attendance-reports/export?date_from=2026-09-01&date_to=2026-09-30&ministry_id='.$this->ministryId, ['Accept' => 'text/csv'])
        ->assertOk()
        ->assertHeader('Content-Type', 'text/csv; charset=UTF-8');

    $csv = $response->streamedContent();
    expect($csv)->toStartWith("\xEF\xBB\xBFattendance_date,ministry,student,effective_state,session_status,corrected,finalized_at\r\n")
        ->and($csv)->toContain("2026-09-20,'+Primary,\"'=2+3,\"\"run\"\"\",present,finalized,no,");
    $audit = DB::connection('pgsql_migration')->table('audit_events')->where('action', 'attendance.report.exported')->first();
    $metadata = json_decode($audit->metadata_json, true);
    expect($audit->actor_id)->toBe((string) $this->owner->id)
        ->and($audit->correlation_id)->toBe($correlation)
        ->and($metadata)->toMatchArray([
            'date_from' => '2026-09-01', 'date_to' => '2026-09-30',
            'ministry_id' => $this->ministryId, 'result_count' => 1,
        ])
        ->and($audit->metadata_json)->not->toContain('=2+3');
});

it('rejects unbounded or unknown report filters', function (): void {
    $this->getJson('/api/attendance-reports?date_from=2025-01-01&date_to=2026-09-30')->assertUnprocessable();
    $this->getJson('/api/attendance-reports?date_from=2026-09-01&date_to=2026-09-30&child_name=private')->assertUnprocessable();
});

it('does not disclose another church attendance through report filters', function (): void {
    [, $foreignChurch] = ChurchScenario::owner();
    $foreignMinistry = MembershipScenario::ministry($foreignChurch->id);
    $foreignSession = (string) Str::uuid();
    DB::connection('pgsql_migration')->table('attendance_sessions')->insert([
        'id' => $foreignSession, 'church_id' => $foreignChurch->id, 'ministry_id' => $foreignMinistry,
        'attendance_date' => '2026-09-20', 'status' => 'finalized', 'version' => 1,
        'finalized_by' => $this->owner->id, 'finalized_at' => now(), 'created_at' => now(), 'updated_at' => now(),
    ]);

    $this->getJson('/api/attendance-reports?date_from=2026-09-01&date_to=2026-09-30&ministry_id='.$foreignMinistry)
        ->assertOk()->assertJsonCount(0, 'data.sessions')->assertJsonPath('data.summary.finalized_record_count', 0);
});

it('keeps inclusive recorded dates and UTC defaults at a local midnight boundary', function (): void {
    CarbonImmutable::setTestNow('2026-10-01T00:15:00Z');
    try {
        $student = reportStudent($this, 'Boundary Fixture');
        foreach (['2026-08-31', '2026-09-01', '2026-10-01', '2026-10-02'] as $date) {
            reportSession($this, $date, 'finalized', [$student => 'present']);
        }
        $this->getJson('/api/attendance-reports')->assertOk()
            ->assertJsonPath('data.filters.date_from', '2026-09-01')
            ->assertJsonPath('data.filters.date_to', '2026-10-01')
            ->assertJsonPath('data.summary.present_count', 2)->assertJsonCount(2, 'data.sessions');
        $this->getJson('/api/attendance-reports?date_from=2026-09-01&date_to=2026-09-01')
            ->assertOk()->assertJsonPath('data.summary.present_count', 1);
        $this->getJson('/api/attendance-reports?date_from=2025-09-30&date_to=2026-10-01')->assertOk();
        $this->getJson('/api/attendance-reports?date_from=2025-09-30&date_to=2026-10-02')->assertUnprocessable();
    } finally {
        CarbonImmutable::setTestNow();
    }
});

it('keeps authoritative totals and CSV complete when recent sessions are bounded to one hundred', function (): void {
    $student = reportStudent($this, 'Bounded Fixture');
    for ($index = 0; $index < 101; $index++) {
        reportSession($this, CarbonImmutable::parse('2026-01-01')->addDays($index)->toDateString(), 'finalized', [$student => 'present']);
    }
    $path = '?date_from=2026-01-01&date_to=2026-04-30';
    $this->getJson('/api/attendance-reports'.$path)->assertOk()
        ->assertJsonPath('data.summary.present_count', 101)->assertJsonPath('data.summary.finalized_record_count', 101)
        ->assertJsonCount(100, 'data.sessions');
    $csv = $this->get('/api/attendance-reports/export'.$path)->assertOk()->streamedContent();
    expect(substr_count($csv, 'Bounded Fixture'))->toBe(101);
});

it('keeps recorded attendance and append-only evidence unchanged through repeated report reads', function (): void {
    $student = reportStudent($this, 'Immutable Fixture');
    $session = reportSession($this, '2026-09-20', 'revised', [$student => 'absent']);
    $db = DB::connection('pgsql_migration');
    $record = $db->table('attendance_records')->where('attendance_session_id', $session)->first();
    $db->table('attendance_revisions')->insert([
        'id' => (string) Str::uuid(), 'church_id' => $this->church->id, 'attendance_session_id' => $session,
        'attendance_record_id' => $record->id, 'before_state' => 'absent', 'after_state' => 'present',
        'original_actor_id' => $this->owner->id, 'resolving_actor_id' => $this->owner->id,
        'reason' => 'Synthetic revision.', 'revised_at' => now(), 'created_at' => now(), 'updated_at' => now(),
    ]);
    $tables = ['attendance_sessions', 'attendance_records', 'attendance_revisions', 'sync_conflicts', 'audit_events'];
    $before = array_map(fn ($table) => $db->table($table)->orderBy('id')->get()->toJson(), $tables);
    for ($read = 0; $read < 2; $read++) {
        $this->getJson('/api/attendance-reports?date_from=2026-09-01&date_to=2026-09-30')->assertOk()
            ->assertJsonPath('data.summary.present_count', 1)->assertJsonPath('data.sessions.0.status', 'revised');
    }
    expect(array_map(fn ($table) => $db->table($table)->orderBy('id')->get()->toJson(), $tables))->toBe($before);
});

it('denies unassured Owner report and export without producing an export audit', function (): void {
    $this->withPersistedSession(['church_mfa_user_id' => null]);
    $this->getJson('/api/attendance-reports')->assertForbidden();
    $this->get('/api/attendance-reports/export')->assertForbidden();
    expect(DB::connection('pgsql_migration')->table('audit_events')->where('action', 'attendance.report.exported')->count())->toBe(0);
});

it('removes revoked Teacher assignment history and continues to deny CSV export', function (): void {
    [$teacher, $membership] = ChurchScenario::teacher($this->church);
    $db = DB::connection('pgsql_migration');
    $assignment = (string) Str::uuid();
    $db->table('teacher_ministry_assignments')->insert([
        'id' => $assignment, 'church_id' => $this->church->id, 'membership_id' => $membership->id,
        'ministry_id' => $this->ministryId, 'assigned_by' => $this->owner->id, 'created_at' => now(), 'updated_at' => now(),
    ]);
    $student = reportStudent($this, 'Revocation Fixture');
    reportSession($this, '2026-09-20', 'finalized', [$student => 'present']);
    $teacher = User::findOrFail($teacher->id);
    PersistedChurchSession::authenticate($this, $teacher, 'web')->withPersistedSession(['password_hash_web' => $teacher->getAuthPassword()]);
    $query = '?date_from=2026-09-01&date_to=2026-09-30';
    $this->getJson('/api/attendance-reports'.$query)->assertOk()->assertJsonPath('data.summary.present_count', 1);
    $db->table('teacher_ministry_assignments')->where('id', $assignment)->update(['revoked_at' => now()]);
    $this->getJson('/api/attendance-reports'.$query)->assertOk()
        ->assertJsonPath('data.summary.present_count', 0)->assertJsonCount(0, 'data.sessions');
    $this->get('/api/attendance-reports/export'.$query)->assertForbidden();
    expect($db->table('audit_events')->where('action', 'attendance.report.exported')->count())->toBe(0);
});

it('escapes each supported CSV formula prefix while preserving authoritative export data', function (string $prefix): void {
    $student = reportStudent($this, $prefix.'Synthetic');
    reportSession($this, '2026-09-20', 'finalized', [$student => 'present']);
    $csv = $this->get('/api/attendance-reports/export?date_from=2026-09-01&date_to=2026-09-30')->assertOk()->streamedContent();
    expect($csv)->toStartWith("\xEF\xBB\xBF")->toContain("'".$prefix.'Synthetic')->toContain("'+Primary")
        ->not->toContain('date_of_birth');
})->with(['=', '+', '-', '@']);
