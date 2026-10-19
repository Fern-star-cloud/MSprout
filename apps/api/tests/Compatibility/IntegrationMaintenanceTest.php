<?php

use App\Domain\Audit\AuditEntry;
use App\Domain\Audit\AuditWriter;
use App\Domain\Sync\TrustedSystemCoordination;
use App\Domain\Sync\TrustedSystemPurpose;
use App\Jobs\PruneOperationalData;
use App\Jobs\PurgeRevokedDeviceData;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\AuthorityScenario as A;
use Tests\Support\ChurchScenario;
use Tests\Support\IntegrationScenario;
use Tests\Support\MaintenanceScenario;
use Tests\Support\MembershipScenario;
use Tests\Support\PostgresTestDatabase;
use Tests\TestCase;

uses(TestCase::class);
beforeEach(function (): void {
    A::guard();
    PostgresTestDatabase::refresh();
});

function integrationPrune(): array
{
    return json_decode(DB::connection('pgsql_migration')->scalar('SELECT public.prune_operational_data(?,?,?,?)', [now('UTC')->subDays(30), now('UTC')->subDays(180), now('UTC')->subDays(180), now('UTC')->subDays(90)]), true, flags: JSON_THROW_ON_ERROR);
}

it('retains reconstruction feed even when a served cursor claims that it was downloaded', function (): void {
    [$church, , $member] = A::fixture($this);
    $db = DB::connection('pgsql_migration');
    $ministry = MembershipScenario::ministry($church->id);
    $sequence = $db->table('change_feed')->insertGetId(['id' => (string) Str::uuid(), 'church_id' => $church->id, 'ministry_id' => $ministry, 'entity_type' => 'attendance_session', 'entity_id' => (string) Str::uuid(), 'entity_version' => 1, 'action' => 'upsert', 'payload_json' => '{}', 'created_at' => now()->subDays(100)], 'sequence');
    $db->table('device_cursors')->insert(['id' => (string) Str::uuid(), 'church_id' => $church->id, 'membership_id' => $member->id, 'device_id' => (string) Str::uuid(), 'cursor' => $sequence, 'updated_at' => now()]);
    $counts = integrationPrune();
    expect($counts['change_feed'])->toBe(0)->and($db->table('change_feed')->where('sequence', $sequence)->exists())->toBeTrue();
});

it('records only actual pruned receipt coverage and preserves uncertain work as recovery required', function (): void {
    [$church, $actor, $member] = A::fixture($this);
    $db = DB::connection('pgsql_migration');
    $device = (string) Str::uuid();
    $db->table('device_cursors')->insert(['id' => (string) Str::uuid(), 'church_id' => $church->id, 'membership_id' => $member->id, 'device_id' => $device, 'cursor' => 0, 'updated_at' => now()]);
    $received = now()->subDays(181)->startOfSecond();
    $db->table('sync_events')->insert(['id' => (string) Str::uuid(), 'church_id' => $church->id, 'device_id' => $device, 'client_event_id' => (string) Str::uuid(), 'batch_id' => (string) Str::uuid(), 'actor_id' => $actor->id, 'payload_hash' => str_repeat('a', 64), 'result_status' => 'accepted', 'received_at' => $received, 'correlation_id' => (string) Str::uuid()]);
    $counts = integrationPrune();
    $cursor = $db->table('device_cursors')->where('device_id', $device)->first();
    expect($counts['sync_events'])->toBe(1)->and($cursor->receipt_coverage)->toBe('pruned')
        ->and($cursor->full_resync_required)->toBeTrue()->and($cursor->applied_cursor)->toBeNull()
        ->and(CarbonImmutable::parse($cursor->receipt_pruned_through)->equalTo($received))->toBeTrue();
});

it('keeps per-church deletion and its actual audit atomic while preserving earlier church success on later failure', function (): void {
    [, $firstChurch] = ChurchScenario::owner();
    [, $secondChurch] = ChurchScenario::owner();
    $churches = [$firstChurch->id, $secondChurch->id];
    sort($churches);
    $db = DB::connection('pgsql_migration');
    $ids = [];
    foreach ($churches as $church) {
        $id = (string) Str::uuid();
        $ids[$church] = $id;
        $db->table('security_events')->insert(['id' => $id, 'category' => 'security', 'church_id' => $church, 'actor_type' => 'anonymous', 'actor_id' => null, 'action' => 'auth.login_failed', 'target_type' => 'session', 'target_id' => null, 'result' => 'failure', 'correlation_id' => (string) Str::uuid(), 'metadata_json' => '{}', 'occurred_at' => now()->subDays(181)]);
    }
    app('session.store')->flush();
    Auth::forgetGuards();
    app()->instance('request', Request::create('http://localhost'));
    $this->instance(AuditWriter::class, new class($churches[1]) extends AuditWriter
    {
        public function __construct(private string $failChurch) {}

        public function record(AuditEntry $event): void
        {
            if ($event->churchId === $this->failChurch) {
                throw new RuntimeException('isolated church audit failure');
            }
            parent::record($event);
        }
    });
    expect(fn () => MaintenanceScenario::run(fn () => app()->call([new PruneOperationalData, 'handle'])))->toThrow(RuntimeException::class);
    expect($db->table('security_events')->where('id', $ids[$churches[0]])->exists())->toBeFalse()
        ->and($db->table('security_events')->where('id', $ids[$churches[1]])->exists())->toBeTrue()
        ->and($db->table('audit_events')->where('church_id', $churches[0])->where('action', 'operations.retention.pruned')->count())->toBe(1)
        ->and($db->table('audit_events')->where('church_id', $churches[1])->count())->toBe(0)
        ->and($db->table('audit_events')->where('category', 'platform')->where('action', 'operations.retention.pruned')->count())->toBe(0);
});

it('keeps inclusive retention minima exact and never invents historical pruning coverage', function (): void {
    [$church,$actor] = $fixture = A::fixture($this);
    $db = DB::connection('pgsql_migration');
    $cutoff = now('UTC')->subDays(180)->startOfSecond();
    $ids = [];
    foreach ([0, 1] as $seconds) {
        $id = (string) Str::uuid();
        $ids[] = $id;
        $db->table('sync_events')->insert(['id' => $id, 'church_id' => $church->id, 'device_id' => (string) Str::uuid(), 'client_event_id' => (string) Str::uuid(), 'batch_id' => (string) Str::uuid(), 'actor_id' => $actor->id, 'payload_hash' => str_repeat('a', 64), 'result_status' => 'accepted', 'received_at' => $cutoff->copy()->addSeconds($seconds), 'correlation_id' => (string) Str::uuid()]);
    }
    $counts = json_decode(DB::connection('pgsql_migration')->scalar('SELECT public.prune_operational_data(?,?,?,?)', [now()->subDays(30), now()->subDays(180), $cutoff, now()->subDays(90)]), true);
    expect($counts['sync_events'])->toBe(1)->and($db->table('sync_events')->where('id', $ids[0])->exists())->toBeFalse()
        ->and($db->table('sync_events')->where('id', $ids[1])->exists())->toBeTrue()
        ->and($db->table('sync_recovery_progress')->count())->toBe(0);
});

it('rejects borrowed human authority and allows only qualified active or suspended maintenance', function (): void {
    [$church] = A::fixture($this);
    expect(fn () => app()->call([new PruneOperationalData, 'handle']))->toThrow(AuthorizationException::class);
    app('session.store')->flush();
    Auth::forgetGuards();
    app()->instance('request', Request::create('http://localhost'));
    DB::connection('pgsql_migration')->table('churches')->where('id', $church->id)->update(['status' => 'suspended']);
    MaintenanceScenario::run(fn () => app()->call([new PurgeRevokedDeviceData, 'handle']));
    expect(DB::connection('pgsql_migration')->table('audit_events')->where('church_id', $church->id)->where('action', 'operations.devices.purged')->count())->toBe(1);
    expect(fn () => app(TrustedSystemCoordination::class)->run($church->id, TrustedSystemPurpose::BirthdayNotification, fn () => true))->toThrow(AuthorizationException::class);
});

/** Direct restricted-role witnesses; no MaintenanceCoordinator or trusted context is entered. */
function integrationSqlBoundaryFixture(): array
{
    IntegrationScenario::guard();
    [$actor, $church, $member] = ChurchScenario::owner();
    [, $other] = ChurchScenario::owner();
    $admin = DB::connection('pgsql_migration');
    $operational = (string) Str::uuid();
    $security = (string) Str::uuid();
    $globalSecurity = (string) Str::uuid();
    $authorization = (string) Str::uuid();
    $admin->table('operational_events')->insert(['id' => $operational, 'event_type' => 'api.error', 'severity' => 'error', 'correlation_id' => (string) Str::uuid(), 'metadata_json' => '{}', 'occurred_at' => now()->subDays(200)]);
    foreach ([[$security, $church->id], [$globalSecurity, null]] as [$id, $scope]) {
        $admin->table('security_events')->insert(['id' => $id, 'category' => 'security', 'church_id' => $scope, 'actor_type' => 'anonymous', 'actor_id' => null, 'action' => 'auth.login_failed', 'target_type' => 'session', 'target_id' => null, 'result' => 'failure', 'correlation_id' => (string) Str::uuid(), 'metadata_json' => '{}', 'occurred_at' => now()->subDays(200)]);
    }
    $admin->table('offline_authorizations')->insert(['id' => $authorization, 'church_id' => $church->id, 'membership_id' => $member->id, 'device_id' => (string) Str::uuid(), 'expires_at' => now()->subDays(200)]);
    DB::statement("SELECT set_config('app.current_church_id','',false)");

    return compact('actor', 'church', 'other', 'admin', 'operational', 'security', 'globalSecurity', 'authorization');
}

function integrationSqlBoundaryReceipt(string $case, array $observed): void
{
    file_put_contents('/evidence/sql-boundary-'.bin2hex(random_bytes(8)).'.json', json_encode(['case' => $case, 'observed' => $observed], JSON_THROW_ON_ERROR));
}

it('SQL boundary denies ordinary runtime privileged direct calls even with a forged local church', function (string $case): void {
    $f = integrationSqlBoundaryFixture();
    $role = DB::selectOne('SELECT current_user AS name,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user');
    expect($role->name)->toBe(config('database.runtime_role'))->and($role->rolsuper)->toBeFalse()->and($role->rolbypassrls)->toBeFalse();
    expect(DB::table('churches')->count())->toBe(0)->and(DB::table('church_memberships')->count())->toBe(0);
    $audits = $f['admin']->table('audit_events')->count();
    $error = null;
    $value = null;
    try {
        $value = DB::transaction(function () use ($case, $f) {
            if (in_array($case, ['church-prune-forged', 'church-purge-forged'], true)) {
                DB::select("SELECT set_config('app.current_church_id',?,true)", [$f['church']->id]);
                // Other spoofable custom settings are not database authority either.
                DB::statement("SELECT set_config('app.maintenance_worker','true',true)");
            }

            return match ($case) {
                'enumeration' => DB::select('SELECT public.maintenance_church_ids() AS id'),
                'membership-oracle' => [DB::scalar('SELECT public.protected_user_has_memberships(?)', [$f['actor']->id]), DB::scalar('SELECT public.protected_user_has_memberships(?)', [-1])],
                'global-prune' => DB::scalar('SELECT public.prune_global_operational_data(?,?)', [now()->subDays(30), now()->subDays(180)]),
                'church-prune-forged' => DB::scalar('SELECT public.prune_church_operational_data(?,?,?,?)', [$f['church']->id, now()->subDays(180), now()->subDays(180), now()->subDays(90)]),
                'church-purge-forged' => DB::scalar('SELECT public.purge_church_revoked_device_data(?,?,?)', [$f['church']->id, now()->subDays(30), now()->subDays(180)]),
                'legacy-prune' => DB::scalar('SELECT public.prune_operational_data(?,?,?,?)', [now()->subDays(30), now()->subDays(180), now()->subDays(180), now()->subDays(90)]),
                'legacy-purge' => DB::scalar('SELECT public.purge_revoked_device_data(?,?)', [now()->subDays(30), now()->subDays(180)]),
            };
        });
    } catch (QueryException $exception) {
        $error = $exception->errorInfo[0] ?? null;
    }
    $summary = is_string($value) ? json_decode($value, true, flags: JSON_THROW_ON_ERROR) : $value;
    if ($case === 'enumeration') {
        $summary = ['churches_returned' => count($value ?? [])];
    }
    integrationSqlBoundaryReceipt($case, [
        'sqlstate' => $error, 'returned' => $summary,
        'operational_deleted' => ! $f['admin']->table('operational_events')->where('id', $f['operational'])->exists(),
        'foreign_security_deleted' => ! $f['admin']->table('security_events')->where('id', $f['security'])->exists(),
        'foreign_authorization_deleted' => ! $f['admin']->table('offline_authorizations')->where('id', $f['authorization'])->exists(),
        'audit_delta' => $f['admin']->table('audit_events')->count() - $audits,
    ]);
    // Require a real SQL privilege denial, not a PHP worker/context marker.
    expect($error)->toBe('42501');
    expect($f['admin']->table('operational_events')->where('id', $f['operational'])->exists())->toBeTrue()
        ->and($f['admin']->table('security_events')->where('id', $f['security'])->exists())->toBeTrue()
        ->and($f['admin']->table('offline_authorizations')->where('id', $f['authorization'])->exists())->toBeTrue()
        ->and($f['admin']->table('audit_events')->count())->toBe($audits);
})->with(['enumeration', 'membership-oracle', 'global-prune', 'church-prune-forged', 'church-purge-forged', 'legacy-prune', 'legacy-purge']);

it('SQL boundary controls prove forced RLS and reject empty or mismatched settings only', function (): void {
    $f = integrationSqlBoundaryFixture();
    $tables = DB::select("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid IN ('public.churches'::regclass,'public.church_memberships'::regclass)");
    foreach ($tables as $table) {
        expect($table->relrowsecurity)->toBeTrue()->and($table->relforcerowsecurity)->toBeTrue();
    }
    expect(DB::scalar("SELECT has_table_privilege(current_user,'public.operational_events','DELETE')"))->toBeFalse();
    foreach (['', $f['other']->id] as $scope) {
        try {
            MaintenanceScenario::run(fn () => DB::transaction(function () use ($f, $scope): void {
                DB::select("SELECT set_config('app.current_church_id',?,true)", [$scope]);
                DB::select('SELECT public.prune_church_operational_data(?,?,?,?)', [$f['church']->id, now()->subDays(180), now()->subDays(180), now()->subDays(90)]);
            }));
            throw new RuntimeException('Mismatched scope accepted.');
        } catch (QueryException $error) {
            expect($error->errorInfo[0])->toBe('42501');
        }
    }
    $definers = DB::select("SELECT p.proname,p.prosecdef,r.rolsuper,r.rolbypassrls,has_function_privilege(current_user,p.oid,'EXECUTE') AS runtime_execute,EXISTS(SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_execute FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.proname IN ('maintenance_church_ids','protected_user_has_memberships','prune_global_operational_data','prune_church_operational_data','purge_church_revoked_device_data') ORDER BY p.proname");
    expect($definers)->toHaveCount(5);
    foreach ($definers as $function) {
        expect($function->prosecdef)->toBeTrue()->and($function->rolsuper || $function->rolbypassrls)->toBeTrue();
        expect($function->runtime_execute)->toBeFalse()->and($function->public_execute)->toBeFalse();
    }
    integrationSqlBoundaryReceipt('controls', ['forced_rls' => true, 'runtime_superuser' => false, 'runtime_bypassrls' => false, 'direct_delete_grant' => false, 'empty_or_wrong_scope' => '42501', 'definer_owner_bypasses_rls' => true, 'function_permissions' => $definers]);
});

it('SQL boundary published C definitions already permit unaudited global cleanup by runtime', function (): void {
    $f = integrationSqlBoundaryFixture();
    $source = file_get_contents(database_path('migrations/2026_09_29_000004_create_operations_infrastructure.php'));
    $start = strpos($source, '            CREATE OR REPLACE FUNCTION prune_operational_data(');
    $end = strpos($source, '            REVOKE ALL ON FUNCTION record_system_heartbeat(', $start);
    expect($start)->not->toBeFalse()->and($end)->not->toBeFalse();
    $original = str_replace('\\$\\$', '$$', substr($source, $start, $end - $start));
    try {
        $f['admin']->unprepared($original);
        $f['admin']->unprepared('GRANT EXECUTE ON FUNCTION public.prune_operational_data(timestamptz,timestamptz,timestamptz,timestamptz),public.purge_revoked_device_data(timestamptz,timestamptz) TO "'.config('database.runtime_role').'"');
        expect(DB::scalar("SELECT has_function_privilege(current_user,'public.prune_operational_data(timestamptz,timestamptz,timestamptz,timestamptz)','EXECUTE')"))->toBeTrue();
        $prune = json_decode(DB::scalar('SELECT public.prune_operational_data(?,?,?,?)', [now()->subDays(30), now()->subDays(180), now()->subDays(180), now()->subDays(90)]), true, flags: JSON_THROW_ON_ERROR);
        $purge = json_decode(DB::scalar('SELECT public.purge_revoked_device_data(?,?)', [now()->subDays(30), now()->subDays(180)]), true, flags: JSON_THROW_ON_ERROR);
        expect($prune['operational_events'])->toBe(1)->and($prune['security_events'])->toBe(2)
            ->and($purge['authorizations_purged'])->toBe(1)->and($f['admin']->table('audit_events')->count())->toBe(0);
        integrationSqlBoundaryReceipt('published-C', ['source_parent' => 'c5e30e1f3b392a154ac5c64aa39b3ca96c6e6361', 'function_definitions_only' => true, 'prune' => $prune, 'purge' => $purge, 'audit_delta' => 0]);
    } finally {
        $role = config('database.runtime_role');
        $f['admin']->unprepared(str_replace('__RUNTIME_ROLE__', $role, file_get_contents(database_path('sql/coordinated-maintenance.sql'))));
        DB::usingConnection('pgsql_migration', fn () => (require database_path('migrations/2026_10_19_000002_isolate_maintenance_authority.php'))->up());
    }
});
