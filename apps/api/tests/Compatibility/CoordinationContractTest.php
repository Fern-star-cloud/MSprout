<?php

use App\Domain\Sync\ChurchCoordination;
use App\Support\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\PostgresTestDatabase;
use Tests\Support\PublisherScenario as P;
use Tests\TestCase;

require_once __DIR__.'/../Support/coordinated-publisher-worker.php';
uses(TestCase::class);
beforeEach(function (): void {
    P::guard();
    PostgresTestDatabase::refresh();
});
afterEach(fn () => P::cleanup());

it('refuses primary gate acquisition inside a rollbackable savepoint', function (): void {
    [$church, , , $request] = P::fixture($this);
    expect(fn () => app(TenantContext::class)->run($church->id, fn () => DB::transaction(fn () => app(ChurchCoordination::class)->run($request, fn () => true))))->toThrow(LogicException::class);
});

it('refuses late coordination after an advisory or domain lock', function (string $lock): void {
    [$church, , $member, $request] = P::fixture($this);
    expect(fn () => app(TenantContext::class)->run($church->id, function () use ($lock, $member, $request): void {
        if ($lock === 'advisory') {
            DB::select('SELECT pg_advisory_xact_lock(991)');
        } else {
            DB::table('church_memberships')->where('id', $member->id)->lockForUpdate()->first();
        }
        app(ChurchCoordination::class)->run($request, fn () => true);
    }))->toThrow(LogicException::class);
})->with(['advisory', 'domain']);

it('passes fresh models and rejects cloned stale or foreign-church capabilities', function (): void {
    [$church, $actor, , $request] = P::fixture($this);
    $coordination = app(ChurchCoordination::class);
    $captured = null;
    app(TenantContext::class)->run($church->id, function () use ($coordination, $request, $actor, &$captured): void {
        $coordination->run($request, function ($freshMember, $freshActor, $context) use ($actor, &$captured): void {
            expect($freshActor)->not->toBe($actor)->and($freshActor->hasVerifiedEmail())->toBeTrue();
            expect($freshMember->user_id)->toBe($freshActor->id);
            $context->assertUsable();
            $captured = $context;
            $clone = clone $context;
            expect(fn () => $clone->assertUsable())->toThrow(LogicException::class);
            DB::statement("SELECT set_config('app.current_church_id',?,true)", [(string) Str::uuid()]);
            expect(fn () => $context->assertUsable())->toThrow(LogicException::class);
            DB::statement("SELECT set_config('app.current_church_id',?,true)", [$context->churchId]);
            $context->assertUsable();
        });
        expect(fn () => $captured->assertUsable())->toThrow(LogicException::class);
    });
    app(TenantContext::class)->run($church->id, function () use ($captured): void {
        expect(fn () => $captured->assertUsable())->toThrow(LogicException::class);
    });
});

it('invalidates a live capability if its PDO transaction is replaced', function (): void {
    [$church, , , $request] = P::fixture($this);
    app(TenantContext::class)->run($church->id, fn () => app(ChurchCoordination::class)->run($request,
        function ($m, $a, $context): void {
            $context->connection->rollBack();
            $context->connection->beginTransaction();
            DB::statement("SELECT set_config('app.current_church_id',?,true)", [$context->churchId]);
            expect(fn () => $context->assertUsable())->toThrow(LogicException::class);
        }));
});

it('clears callback authority on exceptions and permits an independent whole-operation retry', function (): void {
    [$church, , , $request] = P::fixture($this);
    $coordination = app(ChurchCoordination::class);
    $captured = null;
    $operation = function () use ($request, $coordination, &$captured): void {
        $coordination->run($request, function ($m, $a, $context) use (&$captured): void {
            $captured = $context;
            throw new RuntimeException('Deliberate contract failure');
        });
    };
    expect(fn () => app(TenantContext::class)->run($church->id, $operation))->toThrow(RuntimeException::class, 'Deliberate contract failure');
    expect($captured)->not->toBeNull();
    expect(fn () => $captured->assertUsable())->toThrow(LogicException::class);
    expect(DB::transactionLevel())->toBe(0);
    expect(app(TenantContext::class)->run($church->id, fn () => $coordination->run($request, fn ($m, $a, $c) => $c->transactionId)))->toBeString();
});

it('preserves the primary gate across nested savepoint rollback and expires the capability on callback exit', function (): void {
    [$church, $actor, , $request] = P::fixture($this);
    $worker = null;
    app(TenantContext::class)->run($church->id, function () use ($church, $actor, $request, &$worker): void {
        $coordination = app(ChurchCoordination::class);
        $coordination->run($request, function ($m, $a, $context) use ($coordination, $request, $church, $actor, &$worker): void {
            expect(fn () => DB::transaction(function () use ($coordination, $request): void {
                $coordination->run($request, fn ($m, $a, $c) => $c->assertUsable());
                throw new RuntimeException('Savepoint rollback');
            }))->toThrow(RuntimeException::class, 'Savepoint rollback');
            $context->assertUsable();
            $worker = P::worker(['church' => $church->id, 'actor' => $actor->id, 'publish' => false]);
            fwrite($worker[1][0], "enter\n");
            P::blocked($context->backendPid, $worker[2]['pid']);
        });
        P::blocked((int) DB::scalar('SELECT pg_backend_pid()'), $worker[2]['pid']);
    });
    expect(P::line($worker[1][1])['phase'])->toBe('published');
    fwrite($worker[1][0], "commit\n");
    expect(P::line($worker[1][1])['phase'])->toBe('committed');
    P::close($worker);
});

it('refuses repeatable-read snapshots rather than approving stale post-wait authority', function (): void {
    [$church, , , $request] = P::fixture($this);
    DB::statement('SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    try {
        expect(fn () => app(TenantContext::class)->run($church->id, fn () => app(ChurchCoordination::class)->run($request, fn () => null)))
            ->toThrow(LogicException::class, 'read committed');
    } finally {
        DB::statement('SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL READ COMMITTED');
    }
});

it('refuses fixture writes after a foreign Laravel target is substituted', function (): void {
    $original = config('database.connections.pgsql');
    config(['database.connections.pgsql.database' => 'ministrysprout']);
    DB::purge('pgsql');
    try {
        expect(fn () => P::initialize((string) Str::uuid()))->toThrow(RuntimeException::class, 'foreign Laravel connection');
        expect(fn () => P::grantForProof())->toThrow(RuntimeException::class, 'foreign Laravel connection');
    } finally {
        config(['database.connections.pgsql' => $original]);
        DB::purge('pgsql');
    }
});
