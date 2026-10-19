<?php

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PragmaRX\Google2FA\Google2FA;
use Tests\Support\AuthorityScenario as A;
use Tests\Support\ChurchScenario;
use Tests\Support\IntegrationScenario as I;
use Tests\Support\MembershipScenario;
use Tests\Support\PostgresTestDatabase;
use Tests\TestCase;

uses(TestCase::class);
require_once __DIR__.'/../Support/AuthorityHttpScenario.php';
beforeEach(function (): void {
    I::guard();
    PostgresTestDatabase::refresh();
});
afterEach(function (): void {
    I::cleanup();
    I::resetMode();
    DB::disconnect('pgsql');
    DB::disconnect('pgsql_migration');
});

function integrationWorkerInput($test, string $mode = 'publish'): array
{
    [$church,$actor,,$request,$ministry] = I::ownerFixture($test);
    $id = Str::uuid()->toString();
    DB::connection('pgsql_migration')->table('attendance_sessions')->insert(['id' => $id, 'church_id' => $church->id, 'ministry_id' => $ministry, 'attendance_date' => now()->toDateString(), 'status' => 'draft', 'version' => 1]);

    return ['mode' => $mode, 'church' => $church->id, 'actor' => $actor->id, 'session' => $request->session()->getId(), 'attendance' => $id];
}

it('prevents same-church publication commit inversion using observed independent worker waits', function (bool $rollback): void {
    $input = integrationWorkerInput($this);
    I::activate();
    $first = I::worker($input);
    expect(A::line($first[1][1]))->toBe(['inside' => true]);
    I::send($first, 'go');
    $allocated = A::line($first[1][1]);
    expect($allocated['published'])->toBeTrue();
    $second = I::worker($input);
    A::blocked($first[2]['pid'], $second[2]['pid']);
    expect(DB::connection('pgsql_migration')->table('change_feed')->count())->toBe(0);
    I::send($first, $rollback ? 'rollback' : 'commit');
    $outcome = A::line($first[1][1]);
    expect($outcome[$rollback ? 'rolled_back' : 'committed'])->toBeTrue();
    expect(A::line($second[1][1]))->toBe(['inside' => true]);
    I::send($second, 'go');
    $later = A::line($second[1][1]);
    expect((int) $later['sequence'])->toBeGreaterThan((int) $allocated['sequence']);
    I::send($second, 'commit');
    expect(A::line($second[1][1]))->toBe(['committed' => true]);
    $db = DB::connection('pgsql_migration');
    expect($db->table('change_feed')->count())->toBe($rollback ? 1 : 2)
        ->and((int) $db->table('sync_recovery_progress')->where('church_id', $input['church'])->value('feed_head'))->toBe((int) $later['sequence']);
})->with([false, true]);

it('allows independent church publishers including a shared global User without cross-church serialization', function (bool $shared): void {
    $firstInput = integrationWorkerInput($this);
    $secondInput = integrationWorkerInput($this);
    if ($shared) {
        DB::connection('pgsql_migration')->table('church_memberships')->where('church_id', $secondInput['church'])->where('role', 'owner')->update(['user_id' => $firstInput['actor']]);
        $secondInput['actor'] = $firstInput['actor'];
        $secondInput['session'] = $firstInput['session'];
    }
    I::activate();
    $first = I::worker($firstInput);
    expect(A::line($first[1][1]))->toBe(['inside' => true]);
    I::send($first, 'go');
    $one = A::line($first[1][1]);
    $second = I::worker($secondInput);
    expect(A::line($second[1][1]))->toBe(['inside' => true]);
    I::send($second, 'go');
    $two = A::line($second[1][1]);
    I::send($second, 'commit');
    expect(A::line($second[1][1]))->toBe(['committed' => true]);
    expect(DB::connection('pgsql_migration')->table('change_feed')->where('church_id', $firstInput['church'])->count())->toBe(0)
        ->and(DB::connection('pgsql_migration')->table('change_feed')->where('church_id', $secondInput['church'])->count())->toBe(1);
    I::send($first, 'commit');
    expect(A::line($first[1][1]))->toBe(['committed' => true]);
    expect((int) $two['sequence'])->toBeGreaterThan((int) $one['sequence']);
})->with([false, true]);

it('coordinates maintenance before ordinary publication while leaving another church usable', function (): void {
    $input = integrationWorkerInput($this);
    $otherInput = integrationWorkerInput($this);
    I::activate();
    $maintenance = I::worker(['mode' => 'system', 'church' => $input['church']]);
    expect(A::line($maintenance[1][1]))->toBe(['inside' => true]);
    $publisher = I::worker($input);
    A::blocked($maintenance[2]['pid'], $publisher[2]['pid']);
    $other = I::worker($otherInput);
    expect(A::line($other[1][1]))->toBe(['inside' => true]);
    I::send($other, 'go');
    expect(A::line($other[1][1])['published'])->toBeTrue();
    I::send($other, 'commit');
    expect(A::line($other[1][1]))->toBe(['committed' => true]);
    I::send($maintenance, 'go');
    expect(A::line($maintenance[1][1]))->toBe(['maintained' => true]);
    I::send($maintenance, 'commit');
    expect(A::line($maintenance[1][1]))->toBe(['committed' => true]);
    expect(A::line($publisher[1][1]))->toBe(['inside' => true]);
    I::send($publisher, 'go');
    expect(A::line($publisher[1][1])['published'])->toBeTrue();
    I::send($publisher, 'commit');
    expect(A::line($publisher[1][1]))->toBe(['committed' => true]);
});

it('refuses a sealed cutover while a real legacy writer can still commit and captures its later committed boundary', function (): void {
    $input = integrationWorkerInput($this, 'legacy');
    $old = I::worker($input);
    expect(A::line($old[1][1]))->toBe(['inside' => true]);
    I::send($old, 'go');
    $oldAllocation = A::line($old[1][1]);
    I::prepareCutover();
    DB::disconnect('pgsql');
    expect(DB::connection('pgsql_migration')->scalar('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=? AND state=?)', [$old[2]['pid'], 'idle in transaction']))->toBeTrue();
    try {
        DB::connection('pgsql_migration')->select('SELECT public.activate_coordinated_publication(?::uuid)', [Str::uuid()->toString()]);
        throw new RuntimeException('Undrained writer accepted');
    } catch (QueryException $error) {
        expect($error->errorInfo[0])->toBe('55000');
    }
    expect(DB::connection('pgsql_migration')->table('sync_recovery_progress')->count())->toBe(0);
    I::send($old, 'commit');
    expect(A::line($old[1][1]))->toBe(['committed' => true]);
    I::cleanup();
    I::reopen();
    $activation = I::activate();
    expect((int) $activation['allocation_floor'])->toBeGreaterThanOrEqual((int) $oldAllocation['sequence'])
        ->and((int) DB::connection('pgsql_migration')->table('sync_recovery_progress')->where('church_id', $input['church'])->value('feed_head'))->toBe((int) $oldAllocation['sequence']);
});

it('propagates an actual publication deadlock with whole-transaction consistency and a fresh retry', function (): void {
    $input = integrationWorkerInput($this);
    I::activate();
    $inverted = I::worker(['mode' => 'inverted_progress', 'church' => $input['church']]);
    expect(A::line($inverted[1][1]))->toBe(['inside' => true]);
    $publisher = I::worker($input);
    expect(A::line($publisher[1][1]))->toBe(['inside' => true]);
    I::send($publisher, 'go');
    A::blocked($inverted[2]['pid'], $publisher[2]['pid']);
    I::send($inverted, 'go');
    $invertedResult = A::line($inverted[1][1]);
    $publishedResult = A::line($publisher[1][1]);
    expect(in_array('40P01', [$invertedResult['sqlstate'] ?? null, $publishedResult['sqlstate'] ?? null], true))->toBeTrue();
    if (isset($publishedResult['published'])) {
        I::send($publisher, 'commit');
        expect(A::line($publisher[1][1]))->toBe(['committed' => true]);
    }
    $before = DB::connection('pgsql_migration')->table('change_feed')->count();
    I::cleanup();
    $retry = I::worker($input);
    expect(A::line($retry[1][1]))->toBe(['inside' => true]);
    I::send($retry, 'go');
    $row = A::line($retry[1][1]);
    expect($row['published'])->toBeTrue();
    I::send($retry, 'commit');
    expect(A::line($retry[1][1]))->toBe(['committed' => true]);
    $db = DB::connection('pgsql_migration');
    expect($db->table('change_feed')->count())->toBe($before + 1)
        ->and((int) $db->table('sync_recovery_progress')->where('church_id', $input['church'])->value('feed_head'))->toBe((int) $row['sequence']);
});

it('drains cached sequence consumers and preserves the conservative allocation floor without reseeding', function (): void {
    $input = integrationWorkerInput($this);
    $db = DB::connection('pgsql_migration');
    $db->statement('ALTER SEQUENCE public.change_feed_sequence_seq CACHE 8');
    $cache = I::worker(['mode' => 'cache']);
    $first = A::line($cache[1][1]);
    expect((int) $first['cached'])->toBeGreaterThan(0);
    $reserved = (int) $db->scalar('SELECT last_value FROM public.change_feed_sequence_seq');
    expect($reserved)->toBeGreaterThan((int) $first['cached']);
    $db->statement('ALTER SEQUENCE public.change_feed_sequence_seq CACHE 1');
    I::prepareCutover();
    DB::disconnect('pgsql');
    try {
        $db->select('SELECT public.activate_coordinated_publication(?::uuid)', [Str::uuid()->toString()]);
        throw new RuntimeException('Cached old connection accepted');
    } catch (QueryException $error) {
        expect($error->errorInfo[0])->toBe('55000');
    }
    I::send($cache, 'next');
    $next = A::line($cache[1][1]);
    expect((int) $next['cached'])->toBeGreaterThan((int) $first['cached']);
    I::send($cache, 'close');
    expect(A::line($cache[1][1]))->toBe(['closed' => true]);
    I::cleanup();
    I::reopen();
    $activation = I::activate();
    expect((int) $activation['allocation_floor'])->toBeGreaterThanOrEqual($reserved);
    $publisher = I::worker($input);
    expect(A::line($publisher[1][1]))->toBe(['inside' => true]);
    I::send($publisher, 'go');
    $row = A::line($publisher[1][1]);
    expect((int) $row['sequence'])->toBeGreaterThan((int) $activation['allocation_floor']);
    I::send($publisher, 'commit');
    expect(A::line($publisher[1][1]))->toBe(['committed' => true]);
});

it('serializes actual Owner transfer against activated correction publication in both directions', function (bool $correctionFirst): void {
    config(['session.driver' => 'database', 'session.connection' => 'pgsql']);
    app('session')->forgetDrivers();
    app()->forgetInstance('session.store');
    $this->app->instance('env', 'local');
    $this->withCredentials()->withHeader('Origin', config('app.url'));
    $this->cCookies = [];
    [$actor, $password, $secret] = cLogin($this, true);
    [, $church, $owner] = ChurchScenario::owner();
    [, $target] = ChurchScenario::teacher($church);
    $db = DB::connection('pgsql_migration');
    $db->table('church_memberships')->where('id', $owner->id)->update(['user_id' => $actor->id]);
    $ministry = MembershipScenario::ministry($church->id);
    $student = Str::uuid()->toString();
    $session = Str::uuid()->toString();
    $record = Str::uuid()->toString();
    $db->table('students')->insert(['id' => $student, 'church_id' => $church->id, 'first_name' => 'Synthetic', 'last_name' => 'Qualification', 'gender' => 'unspecified', 'version' => 1]);
    $db->table('attendance_sessions')->insert(['id' => $session, 'church_id' => $church->id, 'ministry_id' => $ministry, 'attendance_date' => '2026-10-17', 'status' => 'finalized', 'version' => 1, 'finalized_by' => $actor->id, 'finalized_at' => now()]);
    $db->table('attendance_records')->insert(['id' => $record, 'church_id' => $church->id, 'attendance_session_id' => $session, 'student_id' => $student, 'state' => 'present', 'recorded_by' => $actor->id]);
    I::activate();
    // Existing independent HTTP workers inherit only this disposable process setting.
    putenv('SYNC_COORDINATED_PUBLICATION=true');
    $_ENV['SYNC_COORDINATED_PUBLICATION'] = $_SERVER['SYNC_COORDINATED_PUBLICATION'] = 'true';
    $key = random_int(100000, 999999);
    $table = $correctionFirst ? 'attendance_revisions' : 'church_memberships';
    $event = $correctionFirst ? 'INSERT' : 'UPDATE';
    $condition = $correctionFirst ? 'true' : "OLD.role='owner' AND NEW.role='teacher'";
    $db->unprepared('CREATE FUNCTION public.pde_http_barrier() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF '.$condition.' THEN PERFORM pg_advisory_xact_lock('.$key.'); END IF; RETURN NEW; END $$');
    $db->unprepared('CREATE TRIGGER pde_http_barrier AFTER '.$event.' ON '.$table.' FOR EACH ROW EXECUTE FUNCTION public.pde_http_barrier()');
    $db->select('SELECT pg_advisory_lock(?)', [$key]);
    try {
        $worker = fn ($path, $body) => A::worker(['mode' => 'http', 'church' => $church->id, 'method' => 'POST', 'path' => $path, 'body' => $body, 'cookies' => $this->cCookies]);
        $correction = $worker('/api/attendance-sessions/'.$session.'/records/'.$record.'/corrections', ['state' => 'absent', 'reason' => 'Synthetic correction']);
        $transfer = $worker('/api/ownership-transfer', ['target_membership_id' => $target->id, 'password' => $password, 'code' => (new Google2FA)->getCurrentOtp($secret)]);
        $first = $correctionFirst ? $correction : $transfer;
        $second = $correctionFirst ? $transfer : $correction;
        fwrite($first[1][0], "enter\n");
        A::blocked((int) $db->scalar('SELECT pg_backend_pid()'), $first[2]['pid']);
        fwrite($second[1][0], "enter\n");
        A::blocked($first[2]['pid'], $second[2]['pid']);
        $db->select('SELECT pg_advisory_unlock(?)', [$key]);
        expect(A::line($first[1][1]))->toBe(['phase' => 'http', 'status' => $correctionFirst ? 200 : 204]);
        expect(A::line($second[1][1]))->toBe(['phase' => 'http', 'status' => $correctionFirst ? 204 : 403]);
        expect($db->table('change_feed')->count())->toBe($correctionFirst ? 1 : 0)
            ->and($db->table('attendance_revisions')->count())->toBe($correctionFirst ? 1 : 0)
            ->and($db->table('audit_events')->where('action', 'ownership.transferred')->count())->toBe(1)
            ->and($db->table('church_memberships')->where('church_id', $church->id)->where('role', 'owner')->where('status', 'active')->value('id'))->toBe($target->id)
            ->and((int) $db->table('sync_recovery_progress')->where('church_id', $church->id)->value('feed_head'))->toBe((int) ($db->table('change_feed')->max('sequence') ?? 0));
    } finally {
        $db->select('SELECT pg_advisory_unlock(?)', [$key]);
        A::cleanup();
        $db->unprepared('DROP FUNCTION public.pde_http_barrier() CASCADE');
        putenv('SYNC_COORDINATED_PUBLICATION=false');
        $_ENV['SYNC_COORDINATED_PUBLICATION'] = $_SERVER['SYNC_COORDINATED_PUBLICATION'] = 'false';
    }
})->with([true, false]);
