<?php

use App\Domain\Audit\AuditWriter;
use App\Jobs\PruneOperationalData;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\ChurchScenario;
use Tests\Support\IntegrationScenario as I;
use Tests\Support\MaintenanceScenario;
use Tests\Support\MembershipScenario;
use Tests\Support\PostgresTestDatabase;
use Tests\Support\SnapshotScenario as S;
use Tests\TestCase;

uses(TestCase::class);
beforeEach(function (): void {
    I::guard();
    PostgresTestDatabase::refresh();
});
afterEach(function (): void {
    I::resetMode();
    DB::disconnect('pgsql');
    DB::disconnect('pgsql_migration');
});

it('keeps all recovery tables under forced RLS and cleanup unavailable to runtime PUBLIC or forged settings', function (): void {
    $f = S::fixture($this);
    $run = S::sealed($this, $f);
    foreach (['offline_recovery_runs', 'offline_recovery_pages', 'sync_recovery_progress'] as $table) {
        expect(DB::table($table)->count())->toBe(0);
        $flags = DB::selectOne('SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid=?::regclass', [$table]);
        expect($flags->relrowsecurity && $flags->relforcerowsecurity)->toBeTrue();
    }
    expect(DB::scalar("SELECT has_function_privilege(current_user,'public.cleanup_recovery_pages(uuid)','EXECUTE')"))->toBeFalse();
    expect(DB::scalar("SELECT has_function_privilege(?,'public.transition_recovery_run(uuid,varchar,jsonb)','EXECUTE')", [config('maintenance.role')]))->toBeFalse();
    expect(DB::scalar("SELECT has_table_privilege(?,'public.device_cursors','UPDATE')", [config('maintenance.role')]))->toBeFalse();
    foreach (['prune_operational_data', 'purge_revoked_device_data', 'maintenance_church_ids', 'protected_user_has_memberships', 'prune_global_operational_data', 'prune_church_operational_data', 'purge_church_revoked_device_data', 'cleanup_recovery_pages'] as $name) {
        expect(DB::scalar("SELECT EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE p.pronamespace='public'::regnamespace AND p.proname=? AND a.privilege_type='EXECUTE' AND (a.grantee=0 OR a.grantee=current_user::regrole))", [$name]))->toBeFalse();
    }
    foreach ([$f['church']->id, (string) Str::uuid()] as $church) {
        try {
            DB::transaction(function () use ($church, $run): void {
                DB::select("SELECT set_config('app.current_church_id',?,true),set_config('app.trusted_worker','yes',true)", [$church]);
                DB::select('SELECT public.cleanup_recovery_pages(?)', [$run['recovery_id']]);
            });
            throw new RuntimeException('Direct runtime cleanup was accepted');
        } catch (QueryException $error) {
            expect($error->errorInfo[0])->toBe('42501');
        }
    }
    expect(DB::connection('pgsql_migration')->table('offline_recovery_pages')->count())->toBeGreaterThan(0);
});

it('serves only the actors authorized ministries and hides inaccessible older references', function (): void {
    [, $foreign] = ChurchScenario::owner();
    $f = S::fixture($this, true);
    $allowed = S::session($f, now()->subDays(100)->toDateString());
    $otherMinistry = MembershipScenario::ministry($f['church']->id);
    $other = S::session(array_replace($f, ['ministry' => $otherMinistry]), now()->subDays(101)->toDateString());
    $foreignMinistry = MembershipScenario::ministry($foreign->id);
    $outside = S::session(array_replace($f, ['church' => $foreign, 'ministry' => $foreignMinistry]), now()->subDays(102)->toDateString());
    $missing = (string) Str::uuid();
    $run = S::sealed($this, $f, array_map(fn ($id) => ['type' => 'reference', 'session_id' => $id], [$allowed['id'], $other['id'], $outside['id'], $missing]));
    $items = S::items($this, $f, $run);
    expect(array_column(array_filter($items, fn ($i) => $i['type'] === 'session'), 'id'))->toBe([$allowed['id']]);
    $references = collect($items)->where('type', 'reference')->keyBy('id');
    expect($references[$allowed['id']]['availability'])->toBe('included');
    foreach ([$other['id'], $outside['id'], $missing] as $id) {
        expect($references[$id]['availability'])->toBe('unavailable');
    }
    expect(json_encode($items))->not->toContain($otherMinistry, $foreign->id, $foreignMinistry);
});

it('rejects forged maintenance identity even if cleanup EXECUTE is accidentally granted to runtime', function (): void {
    $f = S::fixture($this);
    $run = S::sealed($this, $f);
    $db = DB::connection('pgsql_migration');
    $runtime = config('database.runtime_role');
    $db->unprepared('GRANT EXECUTE ON FUNCTION public.cleanup_recovery_pages(uuid) TO "'.$runtime.'"');
    try {
        try {
            DB::transaction(function () use ($f, $run): void {
                DB::select("SELECT set_config('app.current_church_id',?,true),set_config('app.trusted_worker','yes',true)", [$f['church']->id]);
                DB::select('SELECT public.cleanup_recovery_pages(?)', [$run['recovery_id']]);
            });
            throw new RuntimeException('Forged maintenance identity was accepted');
        } catch (QueryException $error) {
            expect($error->errorInfo[0])->toBe('42501');
        }
    } finally {
        $db->unprepared('REVOKE EXECUTE ON FUNCTION public.cleanup_recovery_pages(uuid) FROM "'.$runtime.'"');
    }
    try {
        MaintenanceScenario::run(fn () => DB::transaction(function () use ($f, $run): void {
            DB::select("SELECT set_config('app.current_church_id',?,true)", [$f['church']->id]);
            DB::select('SELECT public.cleanup_recovery_pages(?)', [$run['recovery_id']]);
        }));
        throw new RuntimeException('Unexpired snapshot cleanup was accepted');
    } catch (QueryException $error) {
        expect($error->errorInfo[0])->toBe('23514');
    }
    expect($db->table('offline_recovery_runs')->where('id', $run['recovery_id'])->value('pages_purged_at'))->toBeNull();
});

it('expires an active generation atomically with its audit without granting applied or receipt credit', function (): void {
    $f = S::fixture($this);
    config(['recovery.lifetime_seconds' => 3]);
    $run = S::sealed($this, $f);
    $db = DB::connection('pgsql_migration');
    $before = $db->table('device_cursors')->where('device_id', $f['device'])->first();
    $db->select('SELECT pg_sleep(GREATEST(0,EXTRACT(EPOCH FROM (expires_at-clock_timestamp())))+0.01) FROM offline_recovery_runs WHERE id=?', [$run['recovery_id']]);
    app('session.store')->flush();
    Auth::forgetGuards();
    app()->instance('request', Request::create('/'));
    MaintenanceScenario::run(fn () => app(PruneOperationalData::class)->handle(app(AuditWriter::class)));
    $after = $db->table('device_cursors')->where('device_id', $f['device'])->first();
    expect($after->active_recovery_id)->toBeNull()->and($after->full_resync_required)->toBeTrue()
        ->and($after->applied_cursor)->toBe($before->applied_cursor)
        ->and($after->receipt_coverage)->toBe($before->receipt_coverage)
        ->and($db->table('offline_recovery_runs')->where('id', $run['recovery_id'])->value('state'))->toBe('expired')
        ->and($db->table('audit_events')->where('action', 'offline.recovery.expired')->where('target_id', $run['recovery_id'])->count())->toBe(1);
});

it('refuses revoked assignments devices memberships and changed Owner assurance', function (string $change): void {
    $f = S::fixture($this, in_array($change, ['assignment', 'membership'], true));
    $run = S::sealed($this, $f);
    $db = DB::connection('pgsql_migration');
    match ($change) {
        'assignment' => $db->table('teacher_ministry_assignments')->where('membership_id', $f['member']->id)->update(['revoked_at' => now()]),
        'device' => $db->table('offline_authorizations')->where('device_id', $f['device'])->update(['revoked_at' => now()]),
        'membership' => $db->table('church_memberships')->where('id', $f['member']->id)->update(['status' => 'revoked']),
        'owner_mfa' => $db->table('users')->where('id', $f['actor']->id)->update(['two_factor_confirmed_at' => null]),
    };
    $response = S::read($this, $f, $run);
    expect(in_array($response->status(), [401, 403, 409], true))->toBeTrue();
    expect($response->json())->not->toHaveKey('page');
    expect($db->table('device_cursors')->where('device_id', $f['device'])->value('applied_cursor'))->toBeNull();
})->with(['assignment', 'device', 'membership', 'owner_mfa']);

it('binds recovery to membership device actor church and generation without existence disclosure', function (): void {
    [, $second, $secondMember] = ChurchScenario::owner();
    $f = S::fixture($this);
    $run = S::sealed($this, $f);
    $wrong = array_replace($run, ['generation' => (string) Str::uuid()]);
    S::read($this, $f, $wrong)->assertNotFound();
    $otherDevice = (string) Str::uuid();
    DB::connection('pgsql_migration')->table('offline_authorizations')->insert(['id' => (string) Str::uuid(), 'church_id' => $f['church']->id, 'membership_id' => $f['member']->id, 'device_id' => $otherDevice, 'expires_at' => now()->addDay()]);
    S::read($this, array_replace($f, ['device' => $otherDevice]), $run)->assertNotFound();
    DB::connection('pgsql_migration')->table('church_memberships')->where('id', $secondMember->id)->update(['user_id' => $f['actor']->id]);
    DB::connection('pgsql_migration')->table('offline_authorizations')->insert(['id' => (string) Str::uuid(), 'church_id' => $second->id, 'membership_id' => $secondMember->id, 'device_id' => $f['device'], 'expires_at' => now()->addDay()]);
    $this->withHeader('X-Church-Id', $second->id);
    S::read($this, $f, $run)->assertNotFound();
});

it('rolls back capacity failure without discarding prior input pages', function (): void {
    $f = S::fixture($this);
    config(['recovery.max_output_pages' => 1]);
    S::session($f, now()->toDateString(), 60);
    $run = S::begin($this, $f);
    $a = S::upload($this, $f, $run, [S::event((string) Str::uuid())]);
    $this->postJson('/api/offline/bootstrap/recovery', S::sealing($f, $run, [$a['page_digest']], 1))->assertConflict()->assertJsonPath('code', 'recovery_capacity_exceeded');
    $db = DB::connection('pgsql_migration');
    expect($db->table('offline_recovery_pages')->where('kind', 'output')->count())->toBe(0)
        ->and($db->table('offline_recovery_pages')->where('kind', 'input')->count())->toBe(1)
        ->and($db->table('offline_recovery_runs')->where('id', $run['recovery_id'])->value('state'))->toBe('collecting');
});

it('expires and purges encrypted payloads only in the independently authenticated audited maintenance transaction', function (bool $failAudit): void {
    $f = S::fixture($this);
    config(['recovery.lifetime_seconds' => 3]);
    $old = S::begin($this, $f);
    S::upload($this, $f, $old, [S::event((string) Str::uuid())]);
    config(['recovery.lifetime_seconds' => 14400]);
    $next = S::begin($this, $f);
    $db = DB::connection('pgsql_migration');
    $db->select('SELECT pg_sleep(GREATEST(0,EXTRACT(EPOCH FROM (expires_at-clock_timestamp())))+0.01) FROM offline_recovery_runs WHERE id=?', [$old['recovery_id']]);
    app('session.store')->flush();
    Auth::forgetGuards();
    app()->instance('request', Request::create('/'));
    if ($failAudit) {
        $db->unprepared("CREATE FUNCTION public.snapshot_reject_retention_audit() RETURNS trigger LANGUAGE plpgsql AS \$\$ BEGIN IF NEW.action='offline.recovery.expired' THEN RAISE EXCEPTION 'Isolated audit failure' USING ERRCODE='23514';END IF;RETURN NEW;END \$\$;CREATE TRIGGER snapshot_reject_retention_audit BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.snapshot_reject_retention_audit()");
        try {
            expect(fn () => MaintenanceScenario::run(fn () => app(PruneOperationalData::class)->handle(app(AuditWriter::class))))->toThrow(QueryException::class);
        } finally {
            $db->unprepared('DROP TRIGGER snapshot_reject_retention_audit ON public.audit_events;DROP FUNCTION public.snapshot_reject_retention_audit()');
        }
        expect($db->table('offline_recovery_pages')->where('run_id', $old['recovery_id'])->count())->toBe(1)
            ->and($db->table('offline_recovery_runs')->where('id', $old['recovery_id'])->value('pages_purged_at'))->toBeNull();
    } else {
        MaintenanceScenario::run(fn () => app(PruneOperationalData::class)->handle(app(AuditWriter::class)));
        expect($db->table('offline_recovery_pages')->where('run_id', $old['recovery_id'])->count())->toBe(0)
            ->and($db->table('offline_recovery_runs')->where('id', $old['recovery_id'])->value('pages_purged_at'))->not->toBeNull();
    }
    expect($db->table('device_cursors')->where('device_id', $f['device'])->value('active_recovery_id'))->toBe($next['recovery_id'])
        ->and($db->table('device_cursors')->where('device_id', $f['device'])->value('full_resync_required'))->toBeTrue();
})->with([false, true]);
