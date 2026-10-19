<?php

use App\Domain\Audit\AuditEntry;
use App\Domain\Audit\AuditWriter;
use App\Domain\Sync\MaintenanceCoordinator;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Tests\Support\AuthorityScenario;
use Tests\Support\MaintenanceScenario;
use Tests\Support\PostgresTestDatabase;
use Tests\TestCase;

uses(TestCase::class);
beforeEach(function (): void {
    AuthorityScenario::guard();
    PostgresTestDatabase::refresh();
});

it('rejects runtime SET ROLE and forged worker configuration without changing authority', function (): void {
    $maintenance = config('maintenance.role');
    expect(fn () => DB::statement('SET ROLE "'.$maintenance.'"'))->toThrow(QueryException::class);
    config(['maintenance.process' => true]);
    expect(fn () => app(MaintenanceCoordinator::class)->assertWorker())->toThrow(LogicException::class);
    expect(DB::scalar('SELECT current_user'))->toBe(config('database.runtime_role'));
});

it('authenticates an independent least privilege role with no ownership memberships queue or domain writes', function (): void {
    MaintenanceScenario::run(function (): void {
        app(MaintenanceCoordinator::class)->assertWorker();
        $r = DB::selectOne('SELECT oid,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolinherit,rolreplication FROM pg_roles WHERE rolname=current_user');
        foreach (['rolsuper', 'rolbypassrls', 'rolcreatedb', 'rolcreaterole', 'rolinherit', 'rolreplication'] as $flag) {
            expect($r->$flag)->toBeFalse();
        }
        expect(DB::scalar('SELECT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=? OR roleid=?)', [$r->oid, $r->oid]))->toBeFalse();
        foreach (['jobs', 'students', 'attendance_records', 'change_feed', 'sync_events', 'church_memberships'] as $table) {
            expect(DB::scalar("SELECT has_table_privilege(current_user,?,'INSERT,UPDATE,DELETE')", ['public.'.$table]))->toBeFalse();
        }
        foreach (['audit_events', 'churches', 'users'] as $table) {
            expect(DB::scalar('SELECT relowner=current_user::regrole FROM pg_class WHERE oid=?::regclass', ['public.'.$table]))->toBeFalse();
        }
        expect(DB::scalar("SELECT has_table_privilege(current_user,'public.audit_events','UPDATE,DELETE,TRUNCATE')"))->toBeFalse();
    });
});

it('fails closed on wrong maintenance password and never falls back to runtime', function (): void {
    MaintenanceScenario::run(function (): void {
        config(['database.connections.maintenance_test.password' => bin2hex(random_bytes(32))]);
        DB::purge('maintenance_test');
        expect(fn () => app(MaintenanceCoordinator::class)->assertWorker())->toThrow(QueryException::class);
    });
    expect(DB::scalar('SELECT current_user'))->toBe(config('database.runtime_role'));
});

it('qualifies all seven effective ACLs fixed definer paths and ownership independently of tenant settings', function (): void {
    $rows = DB::select("SELECT p.proname,p.proconfig,p.proowner=current_user::regrole AS runtime_owns,has_function_privilege(current_user,p.oid,'EXECUTE') AS runtime_exec,has_function_privilege(?,p.oid,'EXECUTE') AS worker_exec,EXISTS(SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_exec FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname IN ('maintenance_church_ids','protected_user_has_memberships','prune_global_operational_data','prune_church_operational_data','purge_church_revoked_device_data','prune_operational_data','purge_revoked_device_data')", [config('maintenance.role')]);
    expect($rows)->toHaveCount(7);
    foreach ($rows as $row) {
        expect($row->runtime_exec)->toBeFalse()->and($row->public_exec)->toBeFalse()->and($row->runtime_owns)->toBeFalse()->and($row->worker_exec)->toBe(! in_array($row->proname, ['prune_operational_data', 'purge_revoked_device_data'], true))->and($row->proconfig)->toContain('search_path=pg_catalog');
    }
});

it('writes canonical audit evidence on the same independently authenticated transaction and rolls back on failure', function (): void {
    $id = null;
    expect(function () use (&$id): void {
        MaintenanceScenario::run(function () use (&$id): void {
            DB::transaction(function () use (&$id): void {
                app(AuditWriter::class)->record(new AuditEntry('platform', 'operations.retention.pruned', 'system', null, 'system', null, 'success', metadata: ['count' => 0]));
                $id = DB::scalar('SELECT pg_current_xact_id()::text');
                throw new DomainException('Synthetic audit transaction rollback.');
            });
        });
    })->toThrow(DomainException::class);
    expect($id)->not->toBeNull()->and(DB::connection('pgsql_migration')->table('audit_events')->count())->toBe(0);
});

it('rejects serving HTTP with maintenance process configuration before controller execution', function (): void {
    config(['maintenance.process' => true]);
    $this->getJson('/health/live')->assertStatus(503);
});

it('revokes inherited and unexpected runtime grants and leaves missing maintenance provisioning fail closed', function (): void {
    $db = DB::connection('pgsql_migration');
    $signature = 'public.prune_operational_data(timestamptz,timestamptz,timestamptz,timestamptz)';
    $db->unprepared('GRANT EXECUTE ON FUNCTION '.$signature.' TO "'.config('database.runtime_role').'"');
    config(['maintenance.role' => null]);
    try {
        DB::usingConnection('pgsql_migration', fn () => (require database_path('migrations/2026_10_19_000002_isolate_maintenance_authority.php'))->up());
        expect(DB::scalar("SELECT has_function_privilege(current_user,?,'EXECUTE')", [$signature]))->toBeFalse();
        expect(DB::scalar("SELECT has_function_privilege(?,?,'EXECUTE')", [getenv('DB_TEST_MAINTENANCE_USERNAME'), 'public.prune_global_operational_data(timestamptz,timestamptz)']))->toBeFalse();
    } finally {
        config(['maintenance.role' => getenv('DB_TEST_MAINTENANCE_USERNAME')]);
        DB::usingConnection('pgsql_migration', fn () => (require database_path('migrations/2026_10_19_000002_isolate_maintenance_authority.php'))->up());
    }
});

it('rejects membership based impersonation rather than accepting an inherited maintenance identity', function (): void {
    $db = DB::connection('pgsql_migration');
    $maintenance = config('maintenance.role');
    $runtime = config('database.runtime_role');
    $db->unprepared('GRANT "'.$maintenance.'" TO "'.$runtime.'"');
    try {
        expect(fn () => MaintenanceScenario::run(fn () => app(MaintenanceCoordinator::class)->assertWorker()))->toThrow(LogicException::class);
        expect(fn () => DB::usingConnection('pgsql_migration', fn () => (require database_path('migrations/2026_10_19_000002_isolate_maintenance_authority.php'))->up()))->toThrow(RuntimeException::class);
    } finally {
        $db->unprepared('REVOKE "'.$maintenance.'" FROM "'.$runtime.'"');
        DB::usingConnection('pgsql_migration', fn () => (require database_path('migrations/2026_10_19_000002_isolate_maintenance_authority.php'))->up());
    }
    expect(fn () => DB::statement('SET ROLE "'.$maintenance.'"'))->toThrow(QueryException::class);
});
