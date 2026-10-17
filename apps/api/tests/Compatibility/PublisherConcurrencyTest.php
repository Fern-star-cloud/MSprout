<?php

use Illuminate\Database\QueryException;
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

it('prevents an uncommitted same-church publisher from being overtaken while another church proceeds', function (): void {
    [$church, $actor, $member, , $ministry] = P::fixture($this);
    $epoch = P::initialize($church->id);
    [$other, $otherActor, $otherMember, , $otherMinistry] = P::fixture($this);
    $otherEpoch = P::initialize($other->id);
    P::grantForProof();
    $input = ['church' => $church->id, 'actor' => $actor->id, 'epoch' => $epoch, 'change' => P::change($ministry, $member->id)];
    $a = P::worker($input);
    fwrite($a[1][0], "enter\n");
    $first = P::line($a[1][1]);
    expect($first['phase'])->toBe('published');
    expect(DB::connection('pgsql_migration')->table('change_feed')->count())->toBe(0);
    $b = P::worker($input);
    fwrite($b[1][0], "enter\n");
    P::blocked($a[2]['pid'], $b[2]['pid']);
    $c = P::worker(['church' => $other->id, 'actor' => $otherActor->id, 'epoch' => $otherEpoch, 'change' => P::change($otherMinistry, $otherMember->id)]);
    fwrite($c[1][0], "enter\n");
    expect(P::line($c[1][1])['phase'])->toBe('published');
    fwrite($c[1][0], "commit\n");
    expect(P::line($c[1][1])['phase'])->toBe('committed');
    P::close($c);
    fwrite($a[1][0], "commit\n");
    expect(P::line($a[1][1])['phase'])->toBe('committed');
    P::close($a);
    $second = P::line($b[1][1]);
    expect($second['phase'])->toBe('published')->and($second['sequence'])->toBeGreaterThan($first['sequence']);
    fwrite($b[1][0], "commit\n");
    expect(P::line($b[1][1])['phase'])->toBe('committed');
    P::close($b);
});

it('releases a failed publication and permits an independent whole-operation retry', function (): void {
    [$church, $actor, $member, , $ministry] = P::fixture($this);
    $epoch = P::initialize($church->id);
    P::grantForProof();
    $input = ['church' => $church->id, 'actor' => $actor->id, 'epoch' => $epoch, 'change' => P::change($ministry, $member->id)];
    $a = P::worker($input);
    fwrite($a[1][0], "enter\n");
    $first = P::line($a[1][1]);
    expect($first['phase'])->toBe('published');
    $b = P::worker($input);
    fwrite($b[1][0], "enter\n");
    P::blocked($a[2]['pid'], $b[2]['pid']);
    fwrite($a[1][0], "rollback\n");
    expect(P::line($a[1][1])['phase'])->toBe('refused');
    P::close($a);
    $second = P::line($b[1][1]);
    expect($second['phase'])->toBe('published')->and($second['sequence'])->toBeGreaterThan($first['sequence']);
    fwrite($b[1][0], "commit\n");
    expect(P::line($b[1][1])['phase'])->toBe('committed');
    P::close($b);
    $db = DB::connection('pgsql_migration');
    expect($db->table('change_feed')->count())->toBe(1);
    expect((int) $db->table('sync_recovery_progress')->value('feed_head'))->toBe($second['sequence']);
    expect($db->table('sync_recovery_progress')->value('pruned_through'))->toBeNull();
});

it('does not take a global User row lock when the same identity coordinates two churches', function (): void {
    [$church, $actor] = P::fixture($this);
    [$other] = P::fixture($this);
    $db = DB::connection('pgsql_migration');
    $db->table('church_memberships')->insert(['id' => (string) Str::uuid(), 'church_id' => $other->id, 'user_id' => $actor->id,
        'role' => 'teacher', 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);
    $a = P::worker(['church' => $church->id, 'actor' => $actor->id, 'publish' => false]);
    fwrite($a[1][0], "enter\n");
    expect(P::line($a[1][1])['phase'])->toBe('published');
    $b = P::worker(['church' => $other->id, 'actor' => $actor->id, 'publish' => false]);
    fwrite($b[1][0], "enter\n");
    expect(P::line($b[1][1])['phase'])->toBe('published');
    // Global identity writers remain unfenced: neither church gate blocks this row update.
    $db->transaction(function () use ($db, $actor): void {
        $db->statement("SET LOCAL lock_timeout='300ms'");
        $db->table('users')->where('id', $actor->id)->update(['email_verified_at' => null]);
    });
    foreach ([$a, $b] as $worker) {
        fwrite($worker[1][0], "commit\n");
        expect(P::line($worker[1][1])['phase'])->toBe('committed');
        P::close($worker);
    }
});

it('records session-revocation uncertainty without pretending a request snapshot is a live session proof', function (): void {
    [$church, $actor] = P::fixture($this);
    $db = DB::connection('pgsql_migration');
    $session = Str::random(40);
    $db->table('sessions')->insert(['id' => $session, 'user_id' => $actor->id, 'payload' => '', 'last_activity' => time()]);
    $db->beginTransaction();
    $db->selectOne('SELECT id FROM churches WHERE id=? FOR NO KEY UPDATE', [$church->id]);
    $worker = P::worker(['church' => $church->id, 'actor' => $actor->id, 'publish' => false]);
    fwrite($worker[1][0], "enter\n");
    P::blocked((int) $db->scalar('SELECT pg_backend_pid()'), $worker[2]['pid']);
    $db->table('sessions')->where('id', $session)->delete();
    $db->commit();
    // This deliberately characterizes a limitation. No publisher privilege is granted.
    expect(P::line($worker[1][1])['phase'])->toBe('published');
    expect($db->table('sessions')->where('id', $session)->exists())->toBeFalse();
    fwrite($worker[1][0], "commit\n");
    expect(P::line($worker[1][1])['phase'])->toBe('committed');
    P::close($worker);
    expect(DB::scalar("SELECT has_function_privilege(current_user, ?, 'EXECUTE')", [P::SIGNATURE]))->toBeFalse();
});

it('surfaces a real deadlock and retries only a separate whole coordinated publication', function (): void {
    [$church, $actor, $member, , $ministry] = P::fixture($this);
    $epoch = P::initialize($church->id);
    P::grantForProof();
    $input = ['church' => $church->id, 'actor' => $actor->id, 'epoch' => $epoch, 'change' => P::change($ministry, $member->id)];
    $db = DB::connection('pgsql_migration');
    $db->beginTransaction();
    $db->table('users')->where('id', $actor->id)->lockForUpdate()->first();
    $worker = P::worker([...$input, 'lockActor' => true]);
    fwrite($worker[1][0], "enter\n");
    expect(P::line($worker[1][1])['phase'])->toBe('published');
    fwrite($worker[1][0], "commit\n");
    P::blocked((int) $db->scalar('SELECT pg_backend_pid()'), $worker[2]['pid']);
    $parentCode = null;
    try {
        $db->selectOne('SELECT id FROM churches WHERE id=? FOR NO KEY UPDATE', [$church->id]);
        $db->commit();
    } catch (QueryException $error) {
        $parentCode = (string) $error->getCode();
        $db->rollBack();
    }
    $result = P::line($worker[1][1]);
    expect($parentCode === '40P01' || ($result['code'] ?? null) === '40P01')->toBeTrue();
    if ($result['phase'] === 'refused') {
        expect($result['code'])->toBe('40P01');
        expect($db->table('change_feed')->count())->toBe(0);
        expect((int) $db->table('sync_recovery_progress')->value('feed_head'))->toBe(0);
    }
    P::close($worker);
    $prior = $db->table('change_feed')->count();
    $retry = P::worker($input);
    fwrite($retry[1][0], "enter\n");
    expect(P::line($retry[1][1])['phase'])->toBe('published');
    fwrite($retry[1][0], "commit\n");
    expect(P::line($retry[1][1])['phase'])->toBe('committed');
    P::close($retry);
    expect($db->table('change_feed')->count())->toBe($prior + 1);
});
