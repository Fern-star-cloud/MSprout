<?php

use App\Actions\Invitations\InvitationProof;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Fortify\Fortify;
use PragmaRX\Google2FA\Google2FA;
use Tests\Support\AuthorityScenario as A;
use Tests\Support\ChurchScenario;
use Tests\Support\MembershipScenario;
use Tests\Support\PostgresTestDatabase;
use Tests\TestCase;

uses(TestCase::class);
require_once __DIR__.'/../Support/AuthorityHttpScenario.php';
beforeEach(function (): void {
    A::guard();
    PostgresTestDatabase::refresh();
    DB::connection('pgsql_migration')->unprepared('DROP FUNCTION IF EXISTS public.pc_barrier() CASCADE');
    DB::connection('pgsql_migration')->select('SELECT pg_advisory_unlock_all()');
    config(['session.driver' => 'database', 'session.connection' => 'pgsql']);
    app('session')->forgetDrivers();
    app()->forgetInstance('session.store');
    $this->app->instance('env', 'local');
    $this->withCredentials()->withHeader('Origin', config('app.url'));
    $this->cCookies = [];
});
afterEach(function (): void {
    $db = DB::connection('pgsql_migration');
    if ($db->transactionLevel() > 0) {
        $db->rollBack(0);
    }
    $db->select('SELECT pg_advisory_unlock_all()');
    A::cleanup();
    $db->unprepared('DROP FUNCTION IF EXISTS public.pc_barrier() CASCADE');
});

function cOwner($test): array
{
    [$actor, $password, $secret] = cLogin($test, true);
    [, $church, $membership] = ChurchScenario::owner();
    DB::connection('pgsql_migration')->table('church_memberships')->where('id', $membership->id)->update(['user_id' => $actor->id]);

    return [$actor, $church, $password, $secret];
}

function cWorker($test, string $church, string $method, string $path, ?array $body = null): array
{
    return A::worker(array_filter(['mode' => 'http', 'church' => $church, 'method' => $method, 'path' => $path, 'body' => $body, 'cookies' => $test->cCookies], fn ($v) => $v !== null));
}

// Test-only SQL barrier is installed exclusively by the guarded migration role.
function cBarrier(string $table, string $event, string $condition = 'true'): int
{
    A::guard();
    if (! in_array($table, ['attendance_revisions', 'church_memberships', 'sync_events', 'device_cursors', 'invitations', 'audit_events'], true)
        || ! in_array($event, ['INSERT', 'UPDATE'], true)) {
        throw new LogicException('Unknown isolated barrier.');
    }
    $key = random_int(100000, 999999);
    $admin = DB::connection('pgsql_migration');
    $admin->unprepared('CREATE OR REPLACE FUNCTION public.pc_barrier() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF '.$condition.' THEN PERFORM pg_advisory_xact_lock('.$key.'); END IF; RETURN NEW; END $$');
    $admin->unprepared('CREATE TRIGGER pc_barrier AFTER '.$event.' ON '.$table.' FOR EACH ROW EXECUTE FUNCTION public.pc_barrier()');
    $admin->select('SELECT pg_advisory_lock(?)', [$key]);

    return $key;
}
function cRelease(int $key): void
{
    DB::connection('pgsql_migration')->select('SELECT pg_advisory_unlock(?)', [$key]);
}
function cEnter(array $worker): void
{
    fwrite($worker[1][0], "enter\n");
}
function cStatus(array $worker, int $status): void
{
    expect(A::line($worker[1][1]))->toBe(['phase' => 'http', 'status' => $status]);
    A::close($worker);
}

it('serializes real Owner transfer and attendance correction in either order', function (bool $correctionFirst): void {
    [$actor, $church, $password, $secret] = cOwner($this);
    [, $target] = ChurchScenario::teacher($church);
    $ministry = MembershipScenario::ministry($church->id);
    $db = DB::connection('pgsql_migration');
    $student = (string) Str::uuid();
    $session = (string) Str::uuid();
    $record = (string) Str::uuid();
    $db->table('students')->insert(['id' => $student, 'church_id' => $church->id, 'first_name' => 'Synthetic', 'last_name' => 'Fixture', 'gender' => 'unspecified', 'version' => 1]);
    $db->table('attendance_sessions')->insert(['id' => $session, 'church_id' => $church->id, 'ministry_id' => $ministry, 'attendance_date' => '2026-10-17', 'status' => 'finalized', 'version' => 1, 'finalized_by' => $actor->id, 'finalized_at' => now()]);
    $db->table('attendance_records')->insert(['id' => $record, 'church_id' => $church->id, 'attendance_session_id' => $session, 'student_id' => $student, 'state' => 'present', 'recorded_by' => $actor->id]);
    $correction = cWorker($this, $church->id, 'POST', '/api/attendance-sessions/'.$session.'/records/'.$record.'/corrections', ['state' => 'absent', 'reason' => 'Synthetic correction']);
    $transfer = cWorker($this, $church->id, 'POST', '/api/ownership-transfer', ['target_membership_id' => $target->id, 'password' => $password, 'code' => (new Google2FA)->getCurrentOtp($secret)]);
    $key = $correctionFirst ? cBarrier('attendance_revisions', 'INSERT') : cBarrier('church_memberships', 'UPDATE', "OLD.role='owner' AND NEW.role='teacher'");
    $first = $correctionFirst ? $correction : $transfer;
    $second = $correctionFirst ? $transfer : $correction;
    cEnter($first);
    A::blocked((int) $db->scalar('SELECT pg_backend_pid()'), $first[2]['pid']);
    cEnter($second);
    A::blocked($first[2]['pid'], $second[2]['pid']);
    cRelease($key);
    cStatus($first, $correctionFirst ? 200 : 204);
    cStatus($second, $correctionFirst ? 204 : 403);
    expect($db->table('attendance_revisions')->count())->toBe($correctionFirst ? 1 : 0)
        ->and($db->table('audit_events')->where('action', 'attendance.corrected')->count())->toBe($correctionFirst ? 1 : 0)
        ->and($db->table('audit_events')->where('action', 'ownership.transferred')->count())->toBe(1)
        ->and($db->table('church_memberships')->where('church_id', $church->id)->where('role', 'owner')->where('status', 'active')->pluck('id')->all())->toBe([$target->id])
        ->and($db->table('sessions')->where('user_id', $actor->id)->count())->toBe(0);
})->with([true, false]);

it('allows shared User reads in two churches while a security writer waits for both', function (): void {
    [$first, $actor] = A::fixture($this);
    [, $second] = ChurchScenario::owner();
    $db = DB::connection('pgsql_migration');
    $db->table('church_memberships')->insert(['id' => (string) Str::uuid(), 'church_id' => $second->id, 'user_id' => $actor->id, 'role' => 'teacher', 'status' => 'active']);
    $one = A::worker(['church' => $first->id, 'actor' => $actor->id]);
    $two = A::worker(['church' => $second->id, 'actor' => $actor->id]);
    cEnter($one);
    expect(A::line($one[1][1])['phase'])->toBe('authorized');
    cEnter($two);
    expect(A::line($two[1][1])['phase'])->toBe('authorized');
    $writer = A::worker(['mode' => 'users', 'participants' => [$actor->id => 'write']]);
    cEnter($writer);
    A::blocked($one[2]['pid'], $writer[2]['pid']);
    fwrite($one[1][0], "commit\n");
    expect(A::line($one[1][1])['phase'])->toBe('committed');
    A::close($one);
    A::blocked($two[2]['pid'], $writer[2]['pid']);
    fwrite($two[1][0], "commit\n");
    expect(A::line($two[1][1])['phase'])->toBe('committed');
    A::close($two);
    expect(A::line($writer[1][1])['phase'])->toBe('users_locked');
    fwrite($writer[1][0], "commit\n");
    expect(A::line($writer[1][1])['phase'])->toBe('committed');
    A::close($writer);
});

it('sorts reversed global User participants before taking any high User lock', function (): void {
    $low = User::factory()->create();
    $high = User::factory()->create();
    $db = DB::connection('pgsql_migration');
    $db->beginTransaction();
    $db->selectOne('SELECT id FROM users WHERE id=? FOR UPDATE', [$low->id]);
    $worker = A::worker(['mode' => 'users', 'participants' => [$high->id => 'write', $low->id => 'write']]);
    cEnter($worker);
    A::blocked((int) $db->scalar('SELECT pg_backend_pid()'), $worker[2]['pid']);
    expect($db->selectOne('SELECT id FROM users WHERE id=? FOR UPDATE NOWAIT', [$high->id])->id)->toBe($high->id);
    $db->commit();
    expect(A::line($worker[1][1])['phase'])->toBe('users_locked');
    fwrite($worker[1][0], "commit\n");
    expect(A::line($worker[1][1])['phase'])->toBe('committed');
    A::close($worker);
});

it('rejects password authority changed while a real bootstrap waits at its church gate', function (): void {
    [$actor] = cLogin($this);
    [, $church] = ChurchScenario::owner();
    $db = DB::connection('pgsql_migration');
    $db->table('church_memberships')->insert(['id' => (string) Str::uuid(), 'church_id' => $church->id, 'user_id' => $actor->id, 'role' => 'teacher', 'status' => 'active']);
    $db->beginTransaction();
    $db->selectOne('SELECT id FROM churches WHERE id=? FOR NO KEY UPDATE', [$church->id]);
    $worker = cWorker($this, $church->id, 'GET', '/api/offline/bootstrap?device_id='.Str::uuid());
    cEnter($worker);
    A::blocked((int) $db->scalar('SELECT pg_backend_pid()'), $worker[2]['pid']);
    $db->table('users')->where('id', $actor->id)->update(['password' => bcrypt(Str::password(32))]);
    $db->commit();
    cStatus($worker, 401);
    expect($db->table('offline_authorizations')->count())->toBe(0)->and($db->table('device_cursors')->count())->toBe(0);
});

it('serializes real Teacher revocation against push and pull in both directions', function (string $operation, bool $syncFirst): void {
    [$owner, $church] = cOwner($this);
    $ownerCookies = $this->cCookies;
    $this->startIndependentCookieBrowser();
    $this->cCookies = [];
    [$teacher] = cLogin($this);
    $db = DB::connection('pgsql_migration');
    $membership = (string) Str::uuid();
    $db->table('church_memberships')->insert(['id' => $membership, 'church_id' => $church->id, 'user_id' => $teacher->id, 'role' => 'teacher', 'status' => 'active']);
    $ministry = MembershipScenario::ministry($church->id);
    $db->table('teacher_ministry_assignments')->insert(['id' => (string) Str::uuid(), 'church_id' => $church->id, 'membership_id' => $membership, 'ministry_id' => $ministry, 'assigned_by' => $owner->id]);
    $device = (string) Str::uuid();
    $event = (string) Str::uuid();
    $session = (string) Str::uuid();
    $db->table('offline_authorizations')->insert(['id' => (string) Str::uuid(), 'church_id' => $church->id, 'membership_id' => $membership, 'device_id' => $device, 'expires_at' => now()->addDays(14)]);
    $db->table('device_cursors')->insert(['church_id' => $church->id, 'membership_id' => $membership, 'device_id' => $device, 'cursor' => 0, 'id' => (string) Str::uuid(), 'updated_at' => now()]);
    $db->table('change_feed')->insert(['id' => (string) Str::uuid(), 'church_id' => $church->id, 'ministry_id' => $ministry, 'entity_type' => 'ministry_assignment', 'entity_id' => (string) Str::uuid(), 'entity_version' => 1, 'action' => 'tombstone', 'created_at' => now(), 'payload_json' => json_encode(['ministry_id' => $ministry])]);
    $body = ['device_id' => $device, 'batch_id' => (string) Str::uuid(), 'events' => [['client_event_id' => $event, 'entity_id' => $session, 'action' => 'attendance.draft_created', 'base_version' => 0, 'occurred_at' => now()->toIso8601String(), 'payload' => ['ministry_id' => $ministry, 'attendance_date' => '2026-10-17', 'student_ids' => []]]]];
    $teacherCookies = $this->cCookies;
    $sync = A::worker(['mode' => 'http', 'church' => $church->id, 'method' => $operation === 'push' ? 'POST' : 'GET', 'path' => '/api/sync/'.$operation, 'cookies' => $teacherCookies, 'headers' => ['X-Device-Id' => $device], 'body' => $operation === 'push' ? $body : null]);
    $revoke = A::worker(['mode' => 'http', 'church' => $church->id, 'method' => 'DELETE', 'path' => '/api/teachers/'.$membership, 'cookies' => $ownerCookies]);
    $key = $syncFirst ? cBarrier($operation === 'push' ? 'sync_events' : 'device_cursors', $operation === 'push' ? 'INSERT' : 'UPDATE') : cBarrier('church_memberships', 'UPDATE', "NEW.status='revoked'");
    $first = $syncFirst ? $sync : $revoke;
    $second = $syncFirst ? $revoke : $sync;
    cEnter($first);
    A::blocked((int) $db->scalar('SELECT pg_backend_pid()'), $first[2]['pid']);
    cEnter($second);
    A::blocked($first[2]['pid'], $second[2]['pid']);
    cRelease($key);
    cStatus($first, $syncFirst ? 200 : 204);
    cStatus($second, $syncFirst ? 204 : 403);
    expect($db->table('sync_events')->where('client_event_id', $event)->count())->toBe($syncFirst && $operation === 'push' ? 1 : 0)
        ->and($db->table('sessions')->where('user_id', $teacher->id)->count())->toBe(0)
        ->and($db->table('offline_authorizations')->where('membership_id', $membership)->whereNull('revoked_at')->count())->toBe(0)
        ->and($db->table('church_memberships')->where('id', $membership)->value('status'))->toBe('revoked');
    if ($syncFirst && $operation === 'push') {
        expect($db->table('sync_events')->where('client_event_id', $event)->value('result_status'))->toBe('accepted')
            ->and($db->table('attendance_sessions')->where('id', $session)->value('version'))->toBe(1);
    }
})->with([['push', true], ['push', false], ['pull', true], ['pull', false]]);

it('rechecks assignment removal after bootstrap waits and cannot issue stale offline authority', function (): void {
    [$owner, $church] = cOwner($this);
    $ownerCookies = $this->cCookies;
    $this->startIndependentCookieBrowser();
    $this->cCookies = [];
    [$teacher] = cLogin($this);
    $db = DB::connection('pgsql_migration');
    $member = (string) Str::uuid();
    $db->table('church_memberships')->insert(['id' => $member, 'church_id' => $church->id, 'user_id' => $teacher->id, 'role' => 'teacher', 'status' => 'active']);
    $ministry = MembershipScenario::ministry($church->id);
    $db->table('teacher_ministry_assignments')->insert(['id' => (string) Str::uuid(), 'church_id' => $church->id, 'membership_id' => $member, 'ministry_id' => $ministry, 'assigned_by' => $owner->id]);
    $remove = A::worker(['mode' => 'http', 'church' => $church->id, 'method' => 'PUT', 'path' => '/api/teachers/'.$member.'/assignments', 'cookies' => $ownerCookies, 'body' => ['ministry_ids' => []]]);
    $bootstrap = cWorker($this, $church->id, 'GET', '/api/offline/bootstrap?device_id='.Str::uuid());
    $key = cBarrier('audit_events', 'INSERT', "NEW.action='teacher.assigned'");
    cEnter($remove);
    A::blocked((int) $db->scalar('SELECT pg_backend_pid()'), $remove[2]['pid']);
    cEnter($bootstrap);
    A::blocked($remove[2]['pid'], $bootstrap[2]['pid']);
    cRelease($key);
    cStatus($remove, 200);
    cStatus($bootstrap, 401);
    expect($db->table('offline_authorizations')->count())->toBe(0)
        ->and($db->table('device_cursors')->count())->toBe(0)
        ->and($db->table('teacher_ministry_assignments')->whereNull('revoked_at')->count())->toBe(0);
});

it('rechecks current email MFA and session state after an observed authority wait', function (string $change, int $status): void {
    [$actor, $church] = cOwner($this);
    $db = DB::connection('pgsql_migration');
    $db->beginTransaction();
    $db->selectOne('SELECT id FROM churches WHERE id=? FOR NO KEY UPDATE', [$church->id]);
    $worker = cWorker($this, $church->id, 'GET', '/api/offline/bootstrap?device_id='.Str::uuid());
    cEnter($worker);
    A::blocked((int) $db->scalar('SELECT pg_backend_pid()'), $worker[2]['pid']);
    match ($change) {
        'email' => $db->table('users')->where('id', $actor->id)->update(['email_verified_at' => null]),
        'mfa' => $db->table('users')->where('id', $actor->id)->update(['two_factor_confirmed_at' => null]),
        'session' => $db->table('sessions')->where('user_id', $actor->id)->delete(),
    };
    $db->commit();
    cStatus($worker, $status);
    expect($db->table('offline_authorizations')->count())->toBe(0)->and($db->table('device_cursors')->count())->toBe(0);
})->with([['email', 403], ['mfa', 403], ['session', 401]]);

function cInvitation(string $church, int $inviter, string $email): array
{
    $id = (string) Str::uuid();
    $token = bin2hex(random_bytes(32));
    DB::connection('pgsql_migration')->table('invitations')->insert(['id' => $id, 'church_id' => $church, 'email' => strtolower(trim($email)), 'role' => 'teacher', 'token_hash' => hash('sha256', $token), 'expires_at' => now()->addDay(), 'inviter_id' => $inviter]);
    $body = ['church_id' => $church, 'invitation_id' => $id, 'token' => $token, 'expires' => now()->addHour()->timestamp];
    $body['signature'] = app(InvitationProof::class)->sign($body);

    return $body + ['email' => $email, 'name' => 'Synthetic Invitee', 'password' => Str::password(32)];
}

it('serializes real invitation acceptance against revocation in both directions', function (bool $acceptFirst): void {
    [$owner, $church] = cOwner($this);
    $ownerCookies = $this->cCookies;
    $this->startIndependentCookieBrowser();
    $this->cCookies = [];
    cHttp($this, 'GET', '/sanctum/csrf-cookie')->assertNoContent();
    $body = cInvitation($church->id, $owner->id, 'accept-race@example.test');
    $accept = cWorker($this, $church->id, 'POST', '/api/teacher-invitations/accept', $body);
    $revoke = A::worker(['mode' => 'http', 'church' => $church->id, 'method' => 'DELETE', 'path' => '/api/teacher-invitations/'.$body['invitation_id'], 'cookies' => $ownerCookies]);
    $key = cBarrier('invitations', 'UPDATE', $acceptFirst ? 'NEW.accepted_at IS NOT NULL' : 'NEW.revoked_at IS NOT NULL');
    $first = $acceptFirst ? $accept : $revoke;
    $second = $acceptFirst ? $revoke : $accept;
    cEnter($first);
    A::blocked((int) DB::connection('pgsql_migration')->scalar('SELECT pg_backend_pid()'), $first[2]['pid']);
    cEnter($second);
    A::blocked($first[2]['pid'], $second[2]['pid']);
    cRelease($key);
    cStatus($first, $acceptFirst ? 200 : 204);
    cStatus($second, 410);
    $db = DB::connection('pgsql_migration');
    expect(User::where('email', $body['email'])->count())->toBe($acceptFirst ? 1 : 0)
        ->and($db->table('audit_events')->where('action', 'invitation.accepted')->count())->toBe($acceptFirst ? 1 : 0)
        ->and($db->table('invitations')->where('id', $body['invitation_id'])->whereNotNull('accepted_at')->count())->toBe($acceptFirst ? 1 : 0);
})->with([true, false]);

it('refuses concurrent case-variant account creation across churches without merging identities', function (): void {
    [$owner, $one] = ChurchScenario::owner();
    [$other, $two] = ChurchScenario::owner();
    cHttp($this, 'GET', '/sanctum/csrf-cookie')->assertNoContent();
    $bodyOne = cInvitation($one->id, $owner->id, 'IdentityRace@example.test');
    $bodyTwo = cInvitation($two->id, $other->id, 'identityrace@example.test');
    $first = cWorker($this, $one->id, 'POST', '/api/teacher-invitations/accept', $bodyOne);
    $second = cWorker($this, $two->id, 'POST', '/api/teacher-invitations/accept', $bodyTwo);
    $key = cBarrier('invitations', 'UPDATE', 'NEW.accepted_at IS NOT NULL');
    cEnter($first);
    A::blocked((int) DB::connection('pgsql_migration')->scalar('SELECT pg_backend_pid()'), $first[2]['pid']);
    cEnter($second);
    A::blocked($first[2]['pid'], $second[2]['pid']);
    cRelease($key);
    cStatus($first, 200);
    cStatus($second, 422);
    $db = DB::connection('pgsql_migration');
    expect(User::whereRaw('lower(btrim(email))=?', ['identityrace@example.test'])->count())->toBe(1)
        ->and($db->table('audit_events')->where('action', 'invitation.accepted')->count())->toBe(1)
        ->and($db->table('invitations')->where('id', $bodyTwo['invitation_id'])->value('accepted_at'))->toBeNull();
});

it('fences account navigation with current global User and session authority without a church gate', function (): void {
    [$actor, $church] = cOwner($this);
    $db = DB::connection('pgsql_migration');
    $db->beginTransaction();
    $db->selectOne('SELECT id FROM users WHERE id=? FOR UPDATE', [$actor->id]);
    $worker = cWorker($this, $church->id, 'GET', '/api/me');
    cEnter($worker);
    A::blocked((int) $db->scalar('SELECT pg_backend_pid()'), $worker[2]['pid']);
    $db->table('sessions')->where('user_id', $actor->id)->delete();
    $db->commit();
    cStatus($worker, 401);
});

it('contains a real PostgreSQL deadlock and permits a fresh whole-operation retry', function (): void {
    [$actor] = cLogin($this);
    [, $church] = ChurchScenario::owner();
    $db = DB::connection('pgsql_migration');
    $db->table('church_memberships')->insert(['id' => (string) Str::uuid(), 'church_id' => $church->id, 'user_id' => $actor->id, 'role' => 'teacher', 'status' => 'active']);
    $device = (string) Str::uuid();
    $db->beginTransaction();
    $db->selectOne('SELECT id FROM users WHERE id=? FOR UPDATE', [$actor->id]);
    $worker = cWorker($this, $church->id, 'GET', '/api/offline/bootstrap?device_id='.$device);
    cEnter($worker);
    A::blocked((int) $db->scalar('SELECT pg_backend_pid()'), $worker[2]['pid']);
    $parentVictim = false;
    try {
        // Deliberately invert the approved order ONLY in this isolated migration-role probe.
        $db->selectOne('SELECT id FROM churches WHERE id=? FOR NO KEY UPDATE', [$church->id]);
        $db->commit();
    } catch (QueryException $error) {
        expect($error->errorInfo[0] ?? null)->toBe('40P01');
        $parentVictim = true;
        $db->rollBack();
    }
    cStatus($worker, $parentVictim ? 200 : 500);
    $retry = cWorker($this, $church->id, 'GET', '/api/offline/bootstrap?device_id='.$device);
    cEnter($retry);
    cStatus($retry, 200);
    expect(DB::transactionLevel())->toBe(0)
        ->and($db->table('offline_authorizations')->where('device_id', $device)->count())->toBe(1)
        ->and($db->table('device_cursors')->where('device_id', $device)->count())->toBe(1);
});

it('keeps private invitation delivery synchronous atomic and local to its church queue', function (bool $accept): void {
    [$actor, $church, $password] = cOwner($this);
    $originalCookies = $this->cCookies;
    $recovery = Str::random(10).'-'.Str::random(10);
    $actor->forceFill(['two_factor_recovery_codes' => Fortify::currentEncrypter()->encrypt(json_encode([$recovery]))])->save();
    $this->startIndependentCookieBrowser();
    $this->cCookies = [];
    cHttp($this, 'GET', '/sanctum/csrf-cookie')->assertNoContent();
    cHttp($this, 'POST', '/login', ['email' => $actor->email, 'password' => $password])->assertOk();
    cHttp($this, 'POST', '/two-factor-challenge', ['recovery_code' => $recovery])->assertNoContent();
    $independentCookies = $this->cCookies;
    $this->cCookies = $originalCookies;
    $db = DB::connection('pgsql_migration');
    $ministry = MembershipScenario::ministry($church->id);
    [, $other, $member] = ChurchScenario::owner();
    $db->table('church_memberships')->where('id', $member->id)->update(['user_id' => $actor->id]);
    $smtp = A::worker(['mode' => 'smtp']);
    cEnter($smtp);
    $invite = A::worker(['mode' => 'http', 'method' => 'POST', 'path' => '/api/teacher-invitations', 'church' => $church->id, 'cookies' => $this->cCookies, 'smtpPort' => $smtp[2]['port'], 'body' => ['email' => 'private-smtp@example.test', 'ministry_ids' => [$ministry]]]);
    cEnter($invite);
    expect(A::line($smtp[1][1])['phase'])->toBe('data_received');
    expect($db->table('invitations')->count())->toBe(0)
        ->and($db->table('audit_events')->where('action', 'teacher.invited')->count())->toBe(0);
    $queued = cWorker($this, $church->id, 'GET', '/api/students');
    cEnter($queued);
    A::blocked($invite[2]['pid'], $queued[2]['pid']);
    // A distinct church and ordinary account navigation stay available during SMTP.
    $this->cCookies = $independentCookies;
    $unrelated = cWorker($this, $other->id, 'GET', '/api/offline/bootstrap?device_id='.Str::uuid());
    $navigation = cWorker($this, $church->id, 'GET', '/api/me');
    cEnter($unrelated);
    cStatus($unrelated, 200);
    cEnter($navigation);
    cStatus($navigation, 200);
    fwrite($smtp[1][0], $accept ? "accept\n" : "reject\n");
    cStatus($invite, $accept ? 201 : 500);
    cStatus($queued, 200);
    expect(A::line($smtp[1][1])['phase'])->toBe('smtp_closed');
    A::close($smtp);
    expect($db->table('invitations')->where('church_id', $church->id)->count())->toBe($accept ? 1 : 0)
        ->and($db->table('audit_events')->where('action', 'teacher.invited')->count())->toBe($accept ? 1 : 0)
        ->and($db->table('jobs')->count())->toBe(0)->and($db->table('failed_jobs')->count())->toBe(0);
})->with([true, false]);
