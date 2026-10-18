<?php

use App\Domain\Sync\ChurchCoordination;
use App\Domain\Sync\TrustedSystemCoordination;
use App\Domain\Sync\TrustedSystemPurpose;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Routing\Route;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Tests\Support\AuthorityScenario as A;
use Tests\Support\PostgresTestDatabase;
use Tests\TestCase;

uses(TestCase::class);
require_once __DIR__.'/../Support/AuthorityHttpScenario.php';
beforeEach(function (): void {
    A::guard();
    PostgresTestDatabase::refresh();
});

it('preserves the dormant SQL permission boundary and legacy rights without seeding progress', function (): void {
    $signature = 'public.append_coordinated_change(uuid,uuid,text,uuid,uuid,character varying,uuid,integer,character varying,jsonb)';
    expect(DB::scalar('SELECT to_regprocedure(?) IS NOT NULL', [$signature]))->toBeTrue()
        ->and(DB::scalar("SELECT has_function_privilege(current_user,?,'EXECUTE')", [$signature]))->toBeFalse()
        ->and(DB::scalar("SELECT has_table_privilege(current_user,'change_feed','INSERT')"))->toBeTrue()
        ->and(DB::scalar("SELECT has_sequence_privilege(current_user,'change_feed_sequence_seq','USAGE')"))->toBeTrue()
        ->and(DB::connection('pgsql_migration')->table('sync_recovery_progress')->count())->toBe(0);
    expect(DB::selectOne("SELECT EXISTS(SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a WHERE p.oid=?::regprocedure AND a.grantee=0 AND a.privilege_type='EXECUTE') AS allowed", [$signature])->allowed)->toBeFalse();
});

it('refuses HTTP and elevated-database trusted purpose acquisition and cannot mix authority kinds', function (): void {
    [$church, , , $request] = A::fixture($this);
    Auth::forgetGuards();
    $request->setRouteResolver(fn () => new Route('GET', '/synthetic', fn () => null));
    app()->instance('request', $request);
    expect(fn () => app(TrustedSystemCoordination::class)->run($church->id, TrustedSystemPurpose::RetentionCleanup, fn () => true))->toThrow(AuthorizationException::class);
    $request->setRouteResolver(fn () => null);
    app('session.store')->flush();
    Auth::forgetGuards();
    expect(Auth::guard('web')->check())->toBeFalse();
    $previous = DB::getDefaultConnection();
    DB::setDefaultConnection('pgsql_migration');
    try {
        expect(fn () => app(TrustedSystemCoordination::class)->run($church->id, TrustedSystemPurpose::RetentionCleanup, fn () => true))->toThrow(LogicException::class);
    } finally {
        DB::setDefaultConnection($previous);
    }
    expect(fn () => app(ChurchCoordination::class)->runSystem(TrustedSystemPurpose::RetentionCleanup, fn () => true))->toThrow(LogicException::class);
    expect(DB::transactionLevel())->toBe(0);
});

it('records descriptive real cookie navigation latency without declaring a throughput target', function (): void {
    config(['session.driver' => 'database', 'session.connection' => 'pgsql']);
    app('session')->forgetDrivers();
    app()->forgetInstance('session.store');
    $this->app->instance('env', 'local');
    $this->withCredentials()->withHeader('Origin', config('app.url'));
    $this->cCookies = [];
    cLogin($this);
    $samples = [];
    for ($i = 0; $i < 30; $i++) {
        $start = hrtime(true);
        cHttp($this, 'GET', '/auth/session')->assertOk();
        $samples[] = (hrtime(true) - $start) / 1e6;
    }
    sort($samples);
    file_put_contents('/evidence/navigation-latency.json', json_encode(['scope' => '30 sequential cookie requests; warm isolated local kernel; no load acceptance target', 'samples_ms' => $samples, 'p50_ms' => $samples[14], 'p95_ms' => $samples[28], 'p99_ms' => $samples[29]], JSON_THROW_ON_ERROR));
    expect(count($samples))->toBe(30);
});
