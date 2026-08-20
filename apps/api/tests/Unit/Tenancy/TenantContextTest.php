<?php

use App\Enums\ChurchRole;
use App\Support\Tenancy\TenantContext;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Tests\Support\ChurchScenario;
use Tests\Support\PostgresTestDatabase;
use Tests\TestCase;

uses(TestCase::class);

beforeEach(function (): void {
    PostgresTestDatabase::refresh();
});

it('rejects access when no tenant context is active', function (): void {
    $context = app(TenantContext::class);

    expect(fn () => $context->churchId())->toThrow(LogicException::class)
        ->and(fn () => $context->role())->toThrow(LogicException::class);
});

it('rejects an invalid church identifier before opening tenant scope', function (): void {
    $context = app(TenantContext::class);

    expect(fn () => $context->run('not-a-uuid', static fn (): null => null))
        ->toThrow(InvalidArgumentException::class);
});

it('rejects a tenant context for a user without an active membership', function (): void {
    [$owner, $church] = ChurchScenario::owner();
    $outsider = ChurchScenario::user();
    $this->actingAs($outsider);

    expect(fn () => app(TenantContext::class)->run($church->id, static fn (): null => null))
        ->toThrow(AuthorizationException::class);
});

it('rejects stale membership context', function (): void {
    [, $church] = ChurchScenario::owner();
    [$teacher, $membership] = ChurchScenario::teacher($church);

    DB::connection('pgsql_migration')
        ->table('church_memberships')
        ->where('id', $membership->id)
        ->update(['status' => 'inactive', 'updated_at' => now()]);

    $this->actingAs($teacher);

    expect(fn () => app(TenantContext::class)->run($church->id, static fn (): null => null))
        ->toThrow(AuthorizationException::class);
});

it('rejects nested execution for another church', function (): void {
    [$owner, $churchA] = ChurchScenario::owner();
    [, $churchB] = ChurchScenario::owner();
    $this->actingAs($owner);
    $context = app(TenantContext::class);

    expect(fn () => $context->run(
        $churchA->id,
        fn (): mixed => $context->run($churchB->id, static fn (): null => null),
    ))->toThrow(LogicException::class);
});

it('keeps same-church nested execution in the authorized scope', function (): void {
    [$owner, $church] = ChurchScenario::owner();
    $this->actingAs($owner);
    $context = app(TenantContext::class);

    $result = $context->run(
        $church->id,
        fn (): array => $context->run(
            $church->id,
            fn (): array => [$context->churchId(), $context->role()],
        ),
    );

    expect($result[0])->toBe($church->id)
        ->and($result[1])->toBe(ChurchRole::Owner);
});

it('clears memory and transaction-local tenant state after failure', function (): void {
    [$owner, $church] = ChurchScenario::owner();
    $this->actingAs($owner);
    $context = app(TenantContext::class);

    try {
        $context->run($church->id, static function (): never {
            throw new RuntimeException('expected test failure');
        });
    } catch (RuntimeException $exception) {
        expect($exception->getMessage())->toBe('expected test failure');
    }

    $databaseTenant = DB::selectOne(
        "SELECT current_setting('app.current_church_id', true) AS church_id",
    )->church_id;

    expect(fn () => $context->churchId())->toThrow(LogicException::class)
        ->and($databaseTenant)->toBeIn([null, '']);
});
