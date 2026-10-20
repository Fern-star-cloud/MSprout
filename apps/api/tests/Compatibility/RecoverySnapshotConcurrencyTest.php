<?php

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PragmaRX\Google2FA\Google2FA;
use Tests\Support\AuthorityScenario as A;
use Tests\Support\ChurchScenario;
use Tests\Support\IntegrationScenario as I;
use Tests\Support\MembershipScenario;
use Tests\Support\PostgresTestDatabase;
use Tests\Support\SnapshotScenario as S;
use Tests\Support\SnapshotWorkers as W;
use Tests\TestCase;

uses(TestCase::class);
beforeEach(function (): void {
    I::guard();
    PostgresTestDatabase::refresh();
});
afterEach(function (): void {
    DB::connection('pgsql_migration')->select('SELECT pg_advisory_unlock_all()');
    I::cleanup();
    W::cleanup();
    DB::connection('pgsql_migration')->unprepared('DROP TRIGGER IF EXISTS snapshot_test_barrier ON offline_recovery_runs;DROP TRIGGER IF EXISTS snapshot_test_barrier ON church_memberships;DROP TRIGGER IF EXISTS snapshot_test_barrier ON teacher_ministry_assignments;DROP TRIGGER IF EXISTS snapshot_test_barrier ON students;DROP FUNCTION IF EXISTS public.snapshot_test_barrier()');
    I::resetMode();
    DB::disconnect('pgsql');
    DB::disconnect('pgsql_migration');
});

function snapshotBarrier(string $table, string $event, string $condition): array
{
    I::guard();
    $db = DB::connection('pgsql_migration');
    $key = random_int(100000, 999999);
    $db->unprepared('CREATE FUNCTION public.snapshot_test_barrier() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF '.$condition.' THEN PERFORM pg_advisory_xact_lock('.$key.');END IF;RETURN NEW;END $$');
    $db->unprepared('CREATE TRIGGER snapshot_test_barrier AFTER '.$event.' ON '.$table.' FOR EACH ROW EXECUTE FUNCTION public.snapshot_test_barrier()');
    $db->select('SELECT pg_advisory_lock(?)', [$key]);

    return [$key, (int) $db->scalar('SELECT pg_backend_pid()')];
}

it('serializes sealing versus committed mutation in both orders without partial visibility or sequence assumptions', function (bool $writerFirst): void {
    $f = S::fixture($this);
    $session = S::session($f, now()->toDateString());
    $run = S::begin($this, $f);
    $a = S::upload($this, $f, $run);
    $seal = S::sealing($f, $run, [$a['page_digest']], 0);
    // Independent HTTP sessions isolate the church-gate race from the session
    // row's own write lock at response termination. Both remain authenticated.
    $writerSession = DB::connection('pgsql_migration')->table('sessions')->where('id', $f['request']->session()->getId())->first();
    $writerSession = (array) $writerSession;
    $writerSession['id'] = Str::random(40);
    DB::connection('pgsql_migration')->table('sessions')->insert($writerSession);
    $writerInput = ['mode' => 'publish', 'church' => $f['church']->id, 'actor' => $f['actor']->id, 'session' => $writerSession['id'], 'attendance' => $session['id']];
    if ($writerFirst) {
        $writer = I::worker($writerInput);
        expect(A::line($writer[1][1]))->toBe(['inside' => true]);
        I::send($writer, 'go');
        $published = A::line($writer[1][1]);
        $snapshot = W::start($f, '/api/offline/bootstrap/recovery', $seal);
        W::enter($snapshot);
        A::blocked($writer[2]['pid'], $snapshot[2]['pid']);
        expect(DB::connection('pgsql_migration')->table('offline_recovery_pages')->where('kind', 'output')->count())->toBe(0);
        I::send($writer, 'commit');
        expect(A::line($writer[1][1]))->toBe(['committed' => true]);
        $result = A::line($snapshot[1][1]);
        expect($result['status'])->toBe(200)->and((int) $result['result']['snapshot_cursor'])->toBeGreaterThanOrEqual((int) $published['sequence']);
        $ready = array_replace($run, $result['result']);
        expect(collect(S::items($this, $f, $ready))->where('type', 'session')->first()['version'])->toBe(2);
    } else {
        [$key, $pid] = snapshotBarrier('offline_recovery_runs', 'UPDATE', "NEW.state='ready'");
        $snapshot = W::start($f, '/api/offline/bootstrap/recovery', $seal);
        W::enter($snapshot);
        A::blocked($pid, $snapshot[2]['pid']);
        $writer = I::worker($writerInput);
        A::blocked($snapshot[2]['pid'], $writer[2]['pid']);
        expect(DB::connection('pgsql_migration')->table('offline_recovery_pages')->where('kind', 'output')->count())->toBe(0)
            ->and(DB::connection('pgsql_migration')->table('offline_recovery_runs')->where('id', $run['recovery_id'])->value('state'))->toBe('collecting');
        DB::connection('pgsql_migration')->select('SELECT pg_advisory_unlock(?)', [$key]);
        $result = A::line($snapshot[1][1]);
        expect($result['status'])->toBe(200);
        expect(A::line($writer[1][1]))->toBe(['inside' => true]);
        I::send($writer, 'go');
        $published = A::line($writer[1][1]);
        I::send($writer, 'commit');
        expect(A::line($writer[1][1]))->toBe(['committed' => true])->and((int) $published['sequence'])->toBeGreaterThan((int) $result['result']['snapshot_cursor']);
        $ready = array_replace($run, $result['result']);
        expect(collect(S::items($this, $f, $ready))->where('type', 'session')->first()['version'])->toBe(1);
    }
})->with([true, false]);

it('keeps concurrent different device admissions bound to their own generation and hold', function (): void {
    $f = S::fixture($this);
    $other = array_replace($f, ['device' => (string) Str::uuid()]);
    $db = DB::connection('pgsql_migration');
    $db->table('device_cursors')->insert(['id' => Str::uuid()->toString(), 'church_id' => $f['church']->id, 'membership_id' => $f['member']->id, 'device_id' => $other['device'], 'cursor' => 0, 'updated_at' => now()]);
    $db->table('offline_authorizations')->insert(['id' => Str::uuid()->toString(), 'church_id' => $f['church']->id, 'membership_id' => $f['member']->id, 'device_id' => $other['device'], 'expires_at' => now()->addDay()]);
    [$key, $pid] = snapshotBarrier('offline_recovery_runs', 'INSERT', "NEW.device_id='".$f['device']."'::uuid");
    $one = W::start($f, '/api/offline/bootstrap/recovery', S::intent($f));
    W::enter($one);
    A::blocked($pid, $one[2]['pid']);
    $two = W::start($other, '/api/offline/bootstrap/recovery', S::intent($other));
    W::enter($two);
    A::blocked($one[2]['pid'], $two[2]['pid']);
    $db->select('SELECT pg_advisory_unlock(?)', [$key]);
    $a = A::line($one[1][1]);
    $b = A::line($two[1][1]);
    expect($a['status'])->toBe(200)->and($b['status'])->toBe(200)
        ->and($db->table('device_cursors')->where('device_id', $f['device'])->value('active_recovery_id'))->toBe($a['result']['recovery_id'])
        ->and($db->table('device_cursors')->where('device_id', $other['device'])->value('active_recovery_id'))->toBe($b['result']['recovery_id']);
    S::read($this, $other, $a['result'])->assertNotFound();
    S::read($this, $f, $b['result'])->assertNotFound();
});

it('reauthorizes actual Owner transfer or Teacher assignment revocation against sealing in both orders', function (string $change, bool $mutationFirst): void {
    $f = S::fixture($this, $change === 'assignment');
    $run = S::begin($this, $f);
    $a = S::upload($this, $f, $run, [S::event((string) Str::uuid())]);
    $seal = S::sealing($f, $run, [$a['page_digest']], 1);
    if ($change === 'transfer') {
        [, $target] = ChurchScenario::teacher($f['church']);
        $mutation = ['/api/ownership-transfer', ['target_membership_id' => $target->id, 'password' => $this->password, 'code' => (new Google2FA)->getCurrentOtp($this->secret)], 'POST'];
        $owner = $f;
        $table = 'church_memberships';
        $condition = "OLD.role='owner' AND NEW.role='teacher'";
    } else {
        $otherMinistry = MembershipScenario::ministry($f['church']->id);
        $mutation = ['/api/teachers/'.$f['member']->id.'/assignments', ['ministry_ids' => [$otherMinistry]], 'PUT'];
        $owner = array_replace($f, ['cookies' => $f['ownerCookies']]);
        $table = 'teacher_ministry_assignments';
        $condition = 'OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL';
    }
    [$key, $pid] = snapshotBarrier($mutationFirst ? $table : 'offline_recovery_runs', 'UPDATE', $mutationFirst ? $condition : "NEW.state='ready'");
    $first = $mutationFirst ? W::start($owner, ...$mutation) : W::start($f, '/api/offline/bootstrap/recovery', $seal);
    W::enter($first);
    A::blocked($pid, $first[2]['pid']);
    $second = $mutationFirst ? W::start($f, '/api/offline/bootstrap/recovery', $seal) : W::start($owner, ...$mutation);
    W::enter($second);
    A::blocked($first[2]['pid'], $second[2]['pid']);
    DB::connection('pgsql_migration')->select('SELECT pg_advisory_unlock(?)', [$key]);
    $one = A::line($first[1][1]);
    $two = A::line($second[1][1]);
    $mutationStatus = $change === 'transfer' ? 204 : 200;
    expect($one['status'])->toBe($mutationFirst ? $mutationStatus : 200);
    if ($mutationFirst) {
        expect(in_array($two['status'], [401, 403], true))->toBeTrue();
        expect(DB::connection('pgsql_migration')->table('offline_recovery_pages')->where('kind', 'output')->count())->toBe(0);
    } else {
        expect($two['status'])->toBe($mutationStatus);
    }
    expect(DB::connection('pgsql_migration')->table('offline_recovery_pages')->where('kind', 'input')->count())->toBe(1)
        ->and(DB::connection('pgsql_migration')->table('device_cursors')->where('device_id', $f['device'])->value('applied_cursor'))->toBeNull();
    $denied = S::read($this, $f, $run);
    expect(in_array($denied->status(), [401, 403], true))->toBeTrue();
})->with(['transfer', 'assignment'])->with([true, false]);

it('serializes actual roster and import commits with sealing and invalidates obsolete roster scope', function (string $kind, bool $mutationFirst): void {
    $f = S::fixture($this);
    $session = S::session($f, now()->toDateString());
    DB::connection('pgsql_migration')->table('enrollments')->insert(['id' => Str::uuid()->toString(), 'church_id' => $f['church']->id, 'student_id' => $session['records'][0]['student_id'], 'ministry_id' => $f['ministry'], 'version' => 1]);
    if ($kind === 'import') {
        $file = UploadedFile::fake()->createWithContent('snapshot.csv', "first_name,last_name,birthdate,gender,ministries,external_reference\nSynthetic,Imported,,,Test ministry,\n");
        $preview = $this->post('/api/imports/students/preview', ['file' => $file], ['Accept' => 'application/json'])->assertOk()->json();
        $mutation = ['/api/imports/'.$preview['id'].'/commit', ['commit_key' => Str::uuid()->toString(), 'row_ids' => array_column($preview['rows'], 'id'), 'ministry_mappings' => []], 'POST'];
    } else {
        $mutation = ['/api/students/'.$session['records'][0]['student_id'], ['first_name' => 'Synthetic', 'last_name' => 'Historical', 'preferred_name' => 'Synthetic updated', 'gender' => 'unspecified', 'ministry_ids' => [$f['ministry']]], 'PUT'];
    }
    $run = S::begin($this, $f);
    $a = S::upload($this, $f, $run, [S::event((string) Str::uuid())]);
    $seal = S::sealing($f, $run, [$a['page_digest']], 1);
    [$key, $pid] = snapshotBarrier($mutationFirst ? 'students' : 'offline_recovery_runs', $mutationFirst && $kind === 'import' ? 'INSERT' : 'UPDATE', $mutationFirst ? 'true' : "NEW.state='ready'");
    $first = $mutationFirst ? W::start($f, ...$mutation) : W::start($f, '/api/offline/bootstrap/recovery', $seal);
    W::enter($first);
    A::blocked($pid, $first[2]['pid']);
    $second = $mutationFirst ? W::start($f, '/api/offline/bootstrap/recovery', $seal) : W::start($f, ...$mutation);
    W::enter($second);
    A::blocked($first[2]['pid'], $second[2]['pid']);
    DB::connection('pgsql_migration')->select('SELECT pg_advisory_unlock(?)', [$key]);
    expect(A::line($first[1][1])['status'])->toBe(200);
    $result = A::line($second[1][1]);
    expect($result['status'])->toBe($mutationFirst ? 409 : 200);
    if ($mutationFirst) {
        expect($result['result']['code'])->toBe('recovery_scope_changed');
    }
    S::read($this, $f, $run)->assertConflict()->assertJsonPath('code', 'recovery_scope_changed');
    expect(DB::connection('pgsql_migration')->table('offline_recovery_pages')->where('kind', 'input')->count())->toBe(1);
})->with(['roster', 'import'])->with([true, false]);

it('serializes generation replacement versus sealing and prevents stale generation writes in both orders', function (bool $replacementFirst): void {
    $f = S::fixture($this);
    $run = S::begin($this, $f);
    $a = S::upload($this, $f, $run);
    $new = S::intent($f);
    [$key, $pid] = snapshotBarrier('offline_recovery_runs', $replacementFirst ? 'INSERT' : 'UPDATE', $replacementFirst ? "NEW.request_id='".$new['request_id']."'::uuid" : "NEW.state='ready'");
    $seal = S::sealing($f, $run, [$a['page_digest']], 0);
    $first = W::start($f, '/api/offline/bootstrap/recovery', $replacementFirst ? $new : $seal);
    W::enter($first);
    A::blocked($pid, $first[2]['pid']);
    $second = W::start($f, '/api/offline/bootstrap/recovery', $replacementFirst ? $seal : $new);
    W::enter($second);
    A::blocked($first[2]['pid'], $second[2]['pid']);
    DB::connection('pgsql_migration')->select('SELECT pg_advisory_unlock(?)', [$key]);
    $one = A::line($first[1][1]);
    $two = A::line($second[1][1]);
    expect($one['status'])->toBe(200)->and($two['status'])->toBe($replacementFirst ? 409 : 200);
    $latest = $replacementFirst ? $one['result']['recovery_id'] : $two['result']['recovery_id'];
    $device = DB::connection('pgsql_migration')->table('device_cursors')->where('device_id', $f['device'])->first();
    expect($device->active_recovery_id)->toBe($latest)->and($device->applied_cursor)->toBeNull()->and($device->full_resync_required)->toBeTrue();
    S::read($this, $f, $run)->assertConflict();
})->with([true, false]);

it('allows a same global User to seal another church while the first church has an uncommitted writer', function (): void {
    [, $otherChurch, $otherMember] = ChurchScenario::owner();
    $otherMinistry = MembershipScenario::ministry($otherChurch->id);
    $f = S::fixture($this);
    $session = S::session($f, now()->toDateString());
    $db = DB::connection('pgsql_migration');
    $db->table('church_memberships')->where('id', $otherMember->id)->update(['user_id' => $f['actor']->id]);
    $device = (string) Str::uuid();
    $db->table('device_cursors')->insert(['id' => (string) Str::uuid(), 'church_id' => $otherChurch->id, 'membership_id' => $otherMember->id, 'device_id' => $device, 'cursor' => 0, 'updated_at' => now()]);
    $db->table('offline_authorizations')->insert(['id' => (string) Str::uuid(), 'church_id' => $otherChurch->id, 'membership_id' => $otherMember->id, 'device_id' => $device, 'expires_at' => now()->addDay()]);
    // Independent devices use independent sessions. Sharing one HTTP session also
    // serializes its final session write, which is distinct from church/User gates.
    $writerSession = $f['request']->session()->getId();
    app('session.store')->setId(Str::random(40));
    $this->withPersistedSession([]);
    $writer = I::worker(['mode' => 'publish', 'church' => $f['church']->id, 'actor' => $f['actor']->id, 'session' => $writerSession, 'attendance' => $session['id']]);
    expect(A::line($writer[1][1]))->toBe(['inside' => true]);
    $this->withHeader('X-Church-Id', $otherChurch->id);
    $other = array_replace($f, ['church' => $otherChurch, 'ministry' => $otherMinistry, 'device' => $device]);
    $run = S::sealed($this, $other);
    expect($run['state'])->toBe('ready')->and($db->table('change_feed')->where('church_id', $f['church']->id)->count())->toBe(0);
    I::send($writer, 'rollback');
    expect(A::line($writer[1][1])['rolled_back'])->toBeTrue();
});
