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
               has_table_privilege(?, c.oid, 'UPDATE')::int AS updatable,
               has_table_privilege(?, c.oid, 'DELETE')::int AS deletable
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = current_schema()
          AND c.relname IN ('attendance_sessions', 'attendance_records')
        ORDER BY c.relname
        SQL, [$runtimeRole, $runtimeRole, $runtimeRole, $runtimeRole]);

    expect($tables)->toHaveCount(2);
    foreach ($tables as $table) {
        expect([(int) $table->rls, (int) $table->forced, (int) $table->selectable, (int) $table->insertable, (int) $table->updatable, (int) $table->deletable])->toBe([1, 1, 1, 1, 1, 0]);
    }
});
