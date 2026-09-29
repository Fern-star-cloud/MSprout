<?php

use App\Models\AttendanceSession;
use App\Models\User;
use App\Policies\AttendancePolicy;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\ChurchScenario;
use Tests\Support\MembershipScenario;
use Tests\Support\PostgresTestDatabase;

beforeEach(function (): void {
    PostgresTestDatabase::refresh();
    [$this->owner, $this->church] = MembershipScenario::owner($this);
    $this->assignedMinistry = MembershipScenario::ministry($this->church->id);
    $this->unassignedMinistry = MembershipScenario::ministry($this->church->id);
    [$teacher, $this->teacherMembership] = ChurchScenario::teacher($this->church);
    $this->teacher = User::findOrFail($teacher->id);
    DB::connection('pgsql_migration')->table('teacher_ministry_assignments')->insert([
        'id' => (string) Str::uuid(),
        'church_id' => $this->church->id,
        'membership_id' => $this->teacherMembership->id,
        'ministry_id' => $this->assignedMinistry,
        'assigned_by' => $this->owner->id,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
});

it('allows an assigned Teacher to create and edit only a draft in the assigned ministry', function (): void {
    $this->actingAs($this->teacher, 'web');

    $permissions = app(TenantContext::class)->run($this->church->id, function (): array {
        $session = AttendanceSession::create([
            'church_id' => $this->church->id,
            'ministry_id' => $this->assignedMinistry,
            'attendance_date' => '2026-09-28',
            'status' => 'draft',
            'version' => 1,
        ]);
        $policy = new AttendancePolicy;
        $draftAllowed = $policy->create($this->teacher, $this->assignedMinistry)
            && $policy->update($this->teacher, $session)
            && $policy->finalize($this->teacher, $session);
        $unassignedDenied = ! $policy->create($this->teacher, $this->unassignedMinistry);
        $session->forceFill(['status' => 'finalized', 'finalized_by' => $this->owner->id, 'finalized_at' => now()])->save();

        return [$draftAllowed, $unassignedDenied, $policy->update($this->teacher, $session), $policy->finalize($this->teacher, $session)];
    });

    expect($permissions)->toBe([true, true, false, false]);
});

it('allows the Owner attendance access while hiding another church session at the RLS boundary', function (): void {
    [, $foreignChurch] = ChurchScenario::owner();
    $foreignMinistry = MembershipScenario::ministry($foreignChurch->id);
    $foreignSessionId = (string) Str::uuid();
    DB::connection('pgsql_migration')->table('attendance_sessions')->insert([
        'id' => $foreignSessionId,
        'church_id' => $foreignChurch->id,
        'ministry_id' => $foreignMinistry,
        'attendance_date' => '2026-09-28',
        'status' => 'draft',
        'version' => 1,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    $this->actingAs($this->owner, 'web');

    $result = app(TenantContext::class)->run($this->church->id, fn (): array => [
        (new AttendancePolicy)->create($this->owner, $this->assignedMinistry),
        AttendanceSession::query()->whereKey($foreignSessionId)->exists(),
    ]);

    expect($result)->toBe([true, false]);
});

it('forces tenant RLS and denies cross-church attendance writes to the restricted runtime role', function (): void {
    [, $foreignChurch] = ChurchScenario::owner();
    $foreignMinistry = MembershipScenario::ministry($foreignChurch->id);
    $this->actingAs($this->owner, 'web');

    expect(fn () => app(TenantContext::class)->run($this->church->id, fn () => AttendanceSession::create([
        'church_id' => $foreignChurch->id,
        'ministry_id' => $foreignMinistry,
        'attendance_date' => '2026-09-28',
        'status' => 'draft',
        'version' => 1,
    ])))->toThrow(QueryException::class);

    $runtimeRole = (string) env('DB_RUNTIME_USERNAME');
    $tables = DB::connection('pgsql_migration')->select(<<<'SQL'
        SELECT c.relname AS name, c.relrowsecurity::int AS rls, c.relforcerowsecurity::int AS forced,
               has_table_privilege(?, c.oid, 'SELECT')::int AS selectable,
               has_table_privilege(?, c.oid, 'INSERT')::int AS insertable,
               has_any_column_privilege(?, c.oid, 'UPDATE')::int AS updatable,
               has_table_privilege(?, c.oid, 'DELETE')::int AS deletable
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = current_schema()
          AND c.relname IN ('attendance_sessions', 'attendance_records', 'attendance_guests', 'attendance_revisions', 'sync_conflicts')
        ORDER BY c.relname
        SQL, [$runtimeRole, $runtimeRole, $runtimeRole, $runtimeRole]);

    expect($tables)->toHaveCount(5);
    foreach ($tables as $table) {
        $expectedUpdatePrivilege = $table->name === 'attendance_revisions' ? 0 : 1;
        expect([(int) $table->rls, (int) $table->forced, (int) $table->selectable, (int) $table->insertable, (int) $table->updatable, (int) $table->deletable])
            ->toBe([1, 1, 1, 1, $expectedUpdatePrivilege, 0]);
    }

    $columnPrivileges = DB::connection('pgsql_migration')->selectOne(<<<'SQL'
        SELECT has_column_privilege(?, 'attendance_guests', 'display_name', 'UPDATE')::int AS guest_evidence,
               has_column_privilege(?, 'attendance_guests', 'status', 'UPDATE')::int AS guest_resolution,
               has_column_privilege(?, 'sync_conflicts', 'existing_value', 'UPDATE')::int AS conflict_evidence,
               has_column_privilege(?, 'sync_conflicts', 'resolution', 'UPDATE')::int AS conflict_resolution
        SQL, [$runtimeRole, $runtimeRole, $runtimeRole, $runtimeRole]);
    expect([(int) $columnPrivileges->guest_evidence, (int) $columnPrivileges->guest_resolution,
        (int) $columnPrivileges->conflict_evidence, (int) $columnPrivileges->conflict_resolution])
        ->toBe([0, 1, 0, 1]);
});

it('hides every guest conflict and revision row from another church at the runtime RLS boundary', function (): void {
    [$foreignOwner, $foreignChurch] = ChurchScenario::owner();
    $foreignMinistry = MembershipScenario::ministry($foreignChurch->id);
    $db = DB::connection('pgsql_migration');
    $studentId = (string) Str::uuid();
    $sessionId = (string) Str::uuid();
    $recordId = (string) Str::uuid();
    $guestId = (string) Str::uuid();
    $conflictId = (string) Str::uuid();
    $revisionId = (string) Str::uuid();
    $deviceId = (string) Str::uuid();
    $correlationId = (string) Str::uuid();
    $db->table('students')->insert([
        'id' => $studentId, 'church_id' => $foreignChurch->id, 'first_name' => 'Foreign',
        'last_name' => 'Student', 'gender' => 'unspecified', 'version' => 1,
        'created_at' => now(), 'updated_at' => now(),
    ]);
    $db->table('attendance_sessions')->insert([
        'id' => $sessionId, 'church_id' => $foreignChurch->id, 'ministry_id' => $foreignMinistry,
        'attendance_date' => '2026-09-29', 'status' => 'finalized', 'version' => 2,
        'finalized_by' => $foreignOwner->id, 'finalized_at' => now(), 'created_at' => now(), 'updated_at' => now(),
    ]);
    $db->table('attendance_guests')->insert([
        'id' => $guestId, 'church_id' => $foreignChurch->id, 'attendance_session_id' => $sessionId,
        'display_name' => 'Foreign Guest', 'gender' => 'unspecified', 'state' => 'present', 'status' => 'pending',
        'created_by' => $foreignOwner->id, 'source_device_id' => $deviceId, 'source_correlation_id' => $correlationId,
        'occurred_at' => now(), 'received_at' => now(), 'created_at' => now(), 'updated_at' => now(),
    ]);
    $db->table('attendance_records')->insert([
        'id' => $recordId, 'church_id' => $foreignChurch->id, 'attendance_session_id' => $sessionId,
        'student_id' => $studentId, 'state' => 'present', 'version' => 1,
        'recorded_by' => $foreignOwner->id, 'recorded_device_id' => $deviceId,
        'recorded_correlation_id' => $correlationId, 'recorded_at' => now(), 'recorded_received_at' => now(),
        'created_at' => now(), 'updated_at' => now(),
    ]);
    $db->table('sync_conflicts')->insert([
        'id' => $conflictId, 'church_id' => $foreignChurch->id, 'attendance_session_id' => $sessionId,
        'attendance_record_id' => $recordId, 'incoming_event_id' => (string) Str::uuid(), 'field' => 'state',
        'base_version' => 1, 'existing_value' => json_encode(['state' => 'present']),
        'incoming_value' => json_encode(['state' => 'absent']), 'existing_actor_id' => $foreignOwner->id,
        'incoming_actor_id' => $foreignOwner->id, 'existing_device_id' => $deviceId, 'incoming_device_id' => $deviceId,
        'existing_correlation_id' => $correlationId, 'incoming_correlation_id' => $correlationId,
        'existing_occurred_at' => now(), 'existing_received_at' => now(), 'incoming_occurred_at' => now(),
        'incoming_received_at' => now(), 'was_finalized' => true, 'status' => 'resolved', 'resolution' => 'existing',
        'resolved_by' => $foreignOwner->id, 'resolved_at' => now(), 'created_at' => now(), 'updated_at' => now(),
    ]);
    $db->table('attendance_revisions')->insert([
        'id' => $revisionId, 'church_id' => $foreignChurch->id, 'attendance_session_id' => $sessionId,
        'attendance_record_id' => $recordId, 'sync_conflict_id' => $conflictId,
        'before_state' => 'present', 'after_state' => 'present', 'original_actor_id' => $foreignOwner->id,
        'resolving_actor_id' => $foreignOwner->id, 'reason' => 'Foreign tenant decision.',
        'revised_at' => now(), 'created_at' => now(), 'updated_at' => now(),
    ]);

    $this->actingAs($this->owner, 'web');
    $visible = app(TenantContext::class)->run($this->church->id, fn (): array => [
        DB::table('attendance_guests')->where('id', $guestId)->exists(),
        DB::table('sync_conflicts')->where('id', $conflictId)->exists(),
        DB::table('attendance_revisions')->where('id', $revisionId)->exists(),
    ]);

    expect($visible)->toBe([false, false, false]);
});
