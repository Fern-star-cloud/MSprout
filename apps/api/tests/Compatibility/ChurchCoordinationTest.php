<?php

use App\Domain\Sync\ChurchCoordination;
use App\Support\Tenancy\TenantContext;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\ChurchScenario;
use Tests\Support\MembershipScenario;
use Tests\Support\PostgresTestDatabase;
use Tests\TestCase;

uses(TestCase::class);

beforeEach(function (): void {
    PostgresTestDatabase::refresh();
    $GLOBALS['p21Workers'] = [];
});

afterEach(function (): void {
    while (DB::connection('pgsql_migration')->transactionLevel() > 0) {
        DB::connection('pgsql_migration')->rollBack();
    }
    foreach ($GLOBALS['p21Workers'] ?? [] as [$process, $pipes]) {
        foreach ($pipes as $pipe) {
            if (is_resource($pipe)) {
                fclose($pipe);
            }
        }
        if (is_resource($process)) {
            proc_terminate($process);
            proc_close($process);
        }
    }
});

it('provides an explicit unintegrated coordination foundation', function (): void {
    expect(class_exists(ChurchCoordination::class))->toBeTrue();
});

function p21Teacher(object $test): array
{
    [, $church] = ChurchScenario::owner();
    [$actor, $membership] = ChurchScenario::teacher($church);
    $test->actingAs($actor);
    $request = Request::create('http://localhost/');
    $request->setUserResolver(fn () => $actor);
    $request->setLaravelSession(app('session.store'));

    return [$church, $actor, $membership, $request];
}

function p21Worker(array $input): array
{
    $process = proc_open(['php', base_path('tests/Support/recovery-coordination-worker.php')], [['pipe', 'r'], ['pipe', 'w'], ['pipe', 'w']], $pipes, base_path());
    if (! is_resource($process)) {
        throw new RuntimeException('Worker unavailable');
    }
    stream_set_timeout($pipes[1], 15);
    $GLOBALS['p21Workers'][] = [$process, $pipes];
    fwrite($pipes[0], json_encode($input, JSON_THROW_ON_ERROR)."\n");
    $first = p21Line($pipes[1]);
    expect($first['phase'])->toBe('context');

    return [$process, $pipes, $first];
}

function p21Line($pipe): array
{
    $line = fgets($pipe);
    if (! is_string($line)) {
        throw new RuntimeException('Worker barrier timed out');
    }

    return json_decode($line, true, 512, JSON_THROW_ON_ERROR);
}

function p21Close(array $worker): void
{
    [$process, $pipes] = $worker;
    fclose($pipes[0]);
    fclose($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[2]);
    expect(proc_close($process))->toBe(0)->and($stderr)->toBe('');
}

function p21WaitBlocked(int $holder, int $waiter): void
{
    $deadline = microtime(true) + 5;
    do {
        $blocked = DB::connection('pgsql_migration')->scalar('SELECT ? = ANY(pg_blocking_pids(?))', [$holder, $waiter]);
        if (microtime(true) > $deadline) {
            throw new RuntimeException('No database-observed coordination wait');
        }
    } while (! $blocked);
}

it('requires an outer trusted tenant transaction', function (): void {
    expect(fn () => app(ChurchCoordination::class)->run(Request::create('/'), fn () => null))->toThrow(LogicException::class);
});

it('supports nested use and rolls back callback work', function (): void {
    [$church, , , $request] = p21Teacher($this);
    $originalName = DB::connection('pgsql_migration')->table('churches')->where('id', $church->id)->value('name');
    expect(fn () => app(TenantContext::class)->run($church->id, fn () => app(ChurchCoordination::class)->run($request, function () use ($request): void {
        expect(app(ChurchCoordination::class)->run($request, fn () => 17))->toBe(17);
        DB::table('churches')->update(['name' => 'Must roll back']);
        throw new RuntimeException('Deliberate rollback');
    })))->toThrow(RuntimeException::class, 'Deliberate rollback');
    expect(DB::connection('pgsql_migration')->table('churches')->where('id', $church->id)->value('name'))->toBe($originalName);
});

it('rechecks assignment and Owner assurance without granting generic business authority', function (): void {
    [$church, $actor, $member, $request] = p21Teacher($this);
    $ministry = MembershipScenario::ministry($church->id);
    expect(fn () => app(TenantContext::class)->run($church->id, fn () => app(ChurchCoordination::class)->run($request, fn () => true, $ministry)))->toThrow(AuthorizationException::class);
    DB::connection('pgsql_migration')->table('teacher_ministry_assignments')->insert(['id' => (string) Str::uuid(), 'church_id' => $church->id, 'membership_id' => $member->id, 'ministry_id' => $ministry, 'assigned_by' => $actor->id, 'created_at' => now(), 'updated_at' => now()]);
    expect(app(TenantContext::class)->run($church->id, fn () => app(ChurchCoordination::class)->run($request, fn () => true, $ministry)))->toBeTrue();
    [$owner, $ownerChurch] = MembershipScenario::owner($this);
    $ownerRequest = Request::create('/');
    $ownerRequest->setUserResolver(fn () => $owner);
    expect(fn () => app(TenantContext::class)->run($ownerChurch->id, fn () => app(ChurchCoordination::class)->run($ownerRequest, fn () => true)))->toThrow(AuthorizationException::class);
    $ownerRequest->setLaravelSession(app('session.store'));
    $ownerRequest->session()->put('church_mfa_user_id', $owner->id);
    expect(app(TenantContext::class)->run($ownerChurch->id, fn () => app(ChurchCoordination::class)->run($ownerRequest, fn () => true)))->toBeTrue();
});

it('serializes same-church gates while allowing a different church to commit', function (string $completion): void {
    [$church, $actor] = p21Teacher($this);
    [$otherChurch, $otherActor] = p21Teacher($this);
    $a = p21Worker(['church' => $church->id, 'actor' => $actor->id]);
    fwrite($a[1][0], "enter\n");
    expect(p21Line($a[1][1])['phase'])->toBe('acquired');
    $b = p21Worker(['church' => $church->id, 'actor' => $actor->id]);
    fwrite($b[1][0], "enter\n");
    p21WaitBlocked($a[2]['pid'], $b[2]['pid']);
    $c = p21Worker(['church' => $otherChurch->id, 'actor' => $otherActor->id]);
    fwrite($c[1][0], "enter\n");
    expect(p21Line($c[1][1])['phase'])->toBe('acquired');
    fwrite($c[1][0], "commit\n");
    expect(p21Line($c[1][1])['phase'])->toBe('committed');
    p21Close($c);
    fwrite($a[1][0], $completion."\n");
    expect(p21Line($a[1][1])['phase'])->toBe($completion === 'commit' ? 'committed' : 'refused');
    p21Close($a);
    expect(p21Line($b[1][1])['phase'])->toBe('acquired');
    fwrite($b[1][0], "commit\n");
    expect(p21Line($b[1][1])['phase'])->toBe('committed');
    p21Close($b);
})->with(['commit', 'rollback']);

it('refuses authority changed while waiting for the actual gate', function (string $change): void {
    [$church, $actor, $member] = p21Teacher($this);
    $ministry = MembershipScenario::ministry($church->id);
    $admin = DB::connection('pgsql_migration');
    $assignment = ['id' => (string) Str::uuid(), 'church_id' => $church->id, 'membership_id' => $member->id, 'ministry_id' => $ministry, 'assigned_by' => $actor->id, 'created_at' => now(), 'updated_at' => now()];
    $admin->table('teacher_ministry_assignments')->insert($assignment);
    $admin->beginTransaction();
    $admin->selectOne('SELECT id FROM churches WHERE id=? FOR NO KEY UPDATE', [$church->id]);
    $worker = p21Worker(['church' => $church->id, 'actor' => $actor->id, 'ministry' => $ministry]);
    fwrite($worker[1][0], "enter\n");
    p21WaitBlocked((int) $admin->scalar('SELECT pg_backend_pid()'), $worker[2]['pid']);
    if ($change === 'role') {
        $admin->table('church_memberships')->where('church_id', $church->id)->where('role', 'owner')->update(['role' => 'teacher']);
    }
    match ($change) {
        'role' => $admin->table('church_memberships')->where('id', $member->id)->update(['role' => 'owner']),
        'membership' => $admin->table('church_memberships')->where('id', $member->id)->update(['status' => 'revoked']),
        'assignment' => $admin->table('teacher_ministry_assignments')->where('id', $assignment['id'])->update(['revoked_at' => now()]),
        'church' => $admin->table('churches')->where('id', $church->id)->update(['status' => 'suspended']),
        'verification' => $admin->table('users')->where('id', $actor->id)->update(['email_verified_at' => null]),
    };
    $admin->commit();
    $result = p21Line($worker[1][1]);
    expect($result['phase'])->toBe('refused')->and($result['type'])->toBe(AuthorizationException::class);
    p21Close($worker);
})->with(['role', 'membership', 'assignment', 'church', 'verification']);

it('revalidates Owner MFA after waiting instead of trusting the supplied actor model', function (): void {
    [$owner, $church] = MembershipScenario::owner($this);
    $admin = DB::connection('pgsql_migration');
    $admin->beginTransaction();
    $admin->selectOne('SELECT id FROM churches WHERE id=? FOR NO KEY UPDATE', [$church->id]);
    $worker = p21Worker(['church' => $church->id, 'actor' => $owner->id, 'mfa' => true]);
    fwrite($worker[1][0], "enter\n");
    p21WaitBlocked((int) $admin->scalar('SELECT pg_backend_pid()'), $worker[2]['pid']);
    $admin->table('users')->where('id', $owner->id)->update(['two_factor_confirmed_at' => null]);
    $admin->commit();
    $result = p21Line($worker[1][1]);
    expect($result['phase'])->toBe('refused')->and($result['type'])->toBe(AuthorizationException::class);
    p21Close($worker);
});

it('rolls back a lock timeout and permits a separate whole-operation retry', function (): void {
    [$church, $actor] = p21Teacher($this);
    $admin = DB::connection('pgsql_migration');
    $admin->beginTransaction();
    $admin->selectOne('SELECT id FROM churches WHERE id=? FOR NO KEY UPDATE', [$church->id]);
    $worker = p21Worker(['church' => $church->id, 'actor' => $actor->id, 'timeout' => true]);
    fwrite($worker[1][0], "enter\n");
    $result = p21Line($worker[1][1]);
    expect($result['phase'])->toBe('refused')->and($result['code'])->toBe('55P03');
    p21Close($worker);
    $admin->rollBack();
    $retry = p21Worker(['church' => $church->id, 'actor' => $actor->id]);
    fwrite($retry[1][0], "enter\n");
    expect(p21Line($retry[1][1])['phase'])->toBe('acquired');
    fwrite($retry[1][0], "commit\n");
    expect(p21Line($retry[1][1])['phase'])->toBe('committed');
    p21Close($retry);
});

it('surfaces a deliberate domain-lock inversion as a deadlock instead of retrying a partial operation', function (): void {
    [$church, $actor] = p21Teacher($this);
    $admin = DB::connection('pgsql_migration');
    $admin->beginTransaction();
    $admin->table('users')->where('id', $actor->id)->lockForUpdate()->first();
    $worker = p21Worker(['church' => $church->id, 'actor' => $actor->id, 'lockActor' => true]);
    fwrite($worker[1][0], "enter\n");
    expect(p21Line($worker[1][1])['phase'])->toBe('acquired');
    fwrite($worker[1][0], "commit\n");
    p21WaitBlocked((int) $admin->scalar('SELECT pg_backend_pid()'), $worker[2]['pid']);
    $parentCode = null;
    try {
        $admin->selectOne('SELECT id FROM churches WHERE id=? FOR NO KEY UPDATE', [$church->id]);
        $admin->commit();
    } catch (QueryException $error) {
        $parentCode = (string) $error->getCode();
        $admin->rollBack();
    }
    $result = p21Line($worker[1][1]);
    expect($parentCode === '40P01' || ($result['code'] ?? null) === '40P01')->toBeTrue();
    expect($parentCode === null || $parentCode === '40P01')->toBeTrue();
    expect(in_array($result['phase'], ['committed', 'refused'], true))->toBeTrue();
    p21Close($worker);
    $retry = p21Worker(['church' => $church->id, 'actor' => $actor->id]);
    fwrite($retry[1][0], "enter\n");
    expect(p21Line($retry[1][1])['phase'])->toBe('acquired');
    fwrite($retry[1][0], "commit\n");
    expect(p21Line($retry[1][1])['phase'])->toBe('committed');
    p21Close($retry);
});
