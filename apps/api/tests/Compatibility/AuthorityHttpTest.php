<?php

use App\Actions\Invitations\InvitationProof;
use App\Domain\Audit\SecurityEventWriter;
use App\Models\User;
use App\Support\Auth\DatabaseSessionAuthority;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Laravel\Fortify\Fortify;
use PragmaRX\Google2FA\Google2FA;
use Tests\Support\AuthorityScenario;
use Tests\Support\ChurchScenario;
use Tests\Support\PostgresTestDatabase;
use Tests\TestCase;

uses(TestCase::class);
beforeEach(function (): void {
    AuthorityScenario::guard();
    PostgresTestDatabase::refresh();
    config(['session.driver' => 'database', 'session.connection' => 'pgsql']);
    app('session')->forgetDrivers();
    app()->forgetInstance('session.store');
    $this->app->instance('env', 'local');
    $this->withCredentials()->withHeader('Origin', config('app.url'));
    $this->cCookies = [];
});

require_once __DIR__.'/../Support/AuthorityHttpScenario.php';

it('retains legitimate remembered authentication after its previous database session disappears', function (): void {
    [$actor] = cLogin($this);
    expect(collect(array_keys($this->cCookies))->contains(fn ($key) => str_starts_with($key, 'remember_web_')))->toBeTrue();
    DB::table('sessions')->where('user_id', $actor->id)->delete();
    cHttp($this, 'GET', '/auth/session')->assertOk()->assertJsonPath('id', $actor->id);
    expect(DB::table('sessions')->where('user_id', $actor->id)->count())->toBe(1);
});

it('preserves real cookie MFA login and removes persisted assurance when MFA is disabled', function (): void {
    [$actor, $password] = cLogin($this, true);
    cHttp($this, 'GET', '/auth/session')->assertOk()->assertJsonPath('mfa_confirmed', true);
    cHttp($this, 'POST', '/user/confirm-password', ['password' => $password])->assertSuccessful();
    cHttp($this, 'DELETE', '/user/two-factor-authentication')->assertSuccessful();
    expect($actor->fresh()->hasEnabledTwoFactorAuthentication())->toBeFalse();
    $rows = DB::table('sessions')->where('user_id', $actor->id)->get();
    foreach ($rows as $row) {
        expect(json_decode(base64_decode($row->payload), true))->not->toHaveKey('church_mfa_user_id');
    }
    cHttp($this, 'GET', '/auth/session')->assertOk()->assertJsonPath('mfa_confirmed', false);
});

it('does not complete a pending MFA login using password authority changed after phase one', function (): void {
    $password = Str::password(32);
    $secret = (new Google2FA)->generateSecretKey();
    $actor = User::factory()->create(['password' => $password]);
    $actor->forceFill(['two_factor_secret' => Fortify::currentEncrypter()->encrypt($secret), 'two_factor_confirmed_at' => now()])->save();
    cHttp($this, 'GET', '/sanctum/csrf-cookie');
    cHttp($this, 'POST', '/login', ['email' => $actor->email, 'password' => $password])->assertOk()->assertJsonPath('two_factor', true);
    $actor->forceFill(['password' => Str::password(32)])->save();
    cHttp($this, 'POST', '/two-factor-challenge', ['code' => (new Google2FA)->getCurrentOtp($secret)])->assertUnauthorized();
    cHttp($this, 'GET', '/auth/session')->assertUnauthorized();
});

it('retains the account session but requires current email proof after a profile email change', function (): void {
    [$actor] = cLogin($this);
    $oldProof = URL::temporarySignedRoute('verification.verify', now()->addMinutes(20), ['id' => $actor->id, 'hash' => sha1($actor->email)]);
    cHttp($this, 'PUT', '/user/profile-information', ['name' => $actor->name, 'email' => 'changed@example.test'])->assertSuccessful();
    cHttp($this, 'GET', '/auth/session')->assertOk()->assertJsonPath('email_verified', false);
    cHttp($this, 'GET', $oldProof)->assertForbidden();
    $fresh = $actor->fresh();
    $proof = URL::temporarySignedRoute('verification.verify', now()->addMinutes(20), ['id' => $fresh->id, 'hash' => sha1($fresh->email)]);
    cHttp($this, 'GET', $proof)->assertSuccessful();
    cHttp($this, 'GET', '/auth/session')->assertOk()->assertJsonPath('email_verified', true);
});

it('rechecks revoked Teacher membership after a real bootstrap request waits at the church boundary', function (): void {
    [$actor] = cLogin($this);
    [$owner, $church] = ChurchScenario::owner();
    $member = (string) Str::uuid();
    $admin = DB::connection('pgsql_migration');
    $admin->table('church_memberships')->insert(['id' => $member, 'church_id' => $church->id, 'user_id' => $actor->id, 'role' => 'teacher', 'status' => 'active']);
    $admin->beginTransaction();
    $admin->selectOne('SELECT id FROM churches WHERE id=? FOR NO KEY UPDATE', [$church->id]);
    $worker = AuthorityScenario::worker(['mode' => 'http', 'path' => '/api/offline/bootstrap?device_id='.Str::uuid(), 'cookies' => $this->cCookies, 'church' => $church->id]);
    try {
        fwrite($worker[1][0], "enter\n");
        AuthorityScenario::blocked((int) $admin->scalar('SELECT pg_backend_pid()'), $worker[2]['pid']);
        $admin->table('church_memberships')->where('id', $member)->update(['status' => 'revoked']);
        $admin->commit();
        expect(AuthorityScenario::line($worker[1][1]))->toBe(['phase' => 'http', 'status' => 403]);
    } finally {
        if ($admin->transactionLevel() > 0) {
            $admin->rollBack();
        }
        AuthorityScenario::close($worker);
    }
    expect($admin->table('offline_authorizations')->count())->toBe(0)
        ->and($admin->table('device_cursors')->count())->toBe(0)
        ->and($admin->table('audit_events')->where('action', 'offline.authorization.issued')->count())->toBe(0);
});

it('refuses a signed invitation whose proof expires during its observed church wait', function (): void {
    [$owner, $church] = ChurchScenario::owner();
    $admin = DB::connection('pgsql_migration');
    $token = bin2hex(random_bytes(32));
    $id = (string) Str::uuid();
    $stamp = time();
    $clock = 'c-clock-'.Str::uuid();
    $admin->table('cache')->insert(['key' => $clock, 'value' => (string) $stamp, 'expiration' => $stamp + 3600]);
    $admin->table('invitations')->insert(['id' => $id, 'church_id' => $church->id, 'email' => 'proof-expiry@example.test', 'role' => 'teacher', 'token_hash' => hash('sha256', $token), 'expires_at' => now()->addDay(), 'inviter_id' => $owner->id]);
    $body = ['church_id' => $church->id, 'invitation_id' => $id, 'token' => $token, 'expires' => $stamp + 60];
    $body['signature'] = app(InvitationProof::class)->sign($body);
    $body += ['email' => 'proof-expiry@example.test', 'name' => 'Synthetic Invitee', 'password' => Str::password(32)];
    cHttp($this, 'GET', '/sanctum/csrf-cookie')->assertNoContent();
    $admin->beginTransaction();
    $admin->selectOne('SELECT id FROM churches WHERE id=? FOR NO KEY UPDATE', [$church->id]);
    $worker = AuthorityScenario::worker(['mode' => 'http', 'method' => 'POST', 'path' => '/api/teacher-invitations/accept', 'body' => $body, 'cookies' => $this->cCookies, 'church' => $church->id, 'clockKey' => $clock]);
    try {
        fwrite($worker[1][0], "enter\n");
        AuthorityScenario::blocked((int) $admin->scalar('SELECT pg_backend_pid()'), $worker[2]['pid']);
        $admin->table('cache')->where('key', $clock)->update(['value' => (string) ($stamp + 61)]);
        $admin->commit();
        expect(AuthorityScenario::line($worker[1][1]))->toBe(['phase' => 'http', 'status' => 410]);
    } finally {
        if ($admin->transactionLevel() > 0) {
            $admin->rollBack();
        }
        AuthorityScenario::close($worker);
    }
    expect(User::where('email', 'proof-expiry@example.test')->exists())->toBeFalse()
        ->and($admin->table('invitations')->where('id', $id)->value('accepted_at'))->toBeNull()
        ->and($admin->table('audit_events')->where('action', 'invitation.accepted')->count())->toBe(0);
});

it('returns the existing validation contract for a normalized profile email collision without modifying either account', function (): void {
    [$actor] = cLogin($this);
    $other = User::factory()->create(['email' => 'ReservedIdentity@example.test']);
    $before = $actor->email;
    cHttp($this, 'PUT', '/user/profile-information', ['name' => $actor->name, 'email' => 'reservedidentity@example.test'])->assertUnprocessable()->assertJsonPath('code', 'validation_failed');
    expect($actor->fresh()->email === $before)->toBeTrue()
        ->and($other->fresh()->email === 'ReservedIdentity@example.test')->toBeTrue();
});

it('does not persist new password-confirmation assurance when its required security audit rolls back', function (): void {
    [$actor, $password] = cLogin($this);
    $this->mock(SecurityEventWriter::class)->shouldReceive('record')->andThrow(new RuntimeException('Synthetic audit failure.'));
    cHttp($this, 'POST', '/user/confirm-password', ['password' => $password])->assertStatus(500);
    $rows = DB::table('sessions')->where('user_id', $actor->id)->get();
    expect($rows->count())->toBe(1);
    foreach ($rows as $row) {
        $claims = DatabaseSessionAuthority::decode(base64_decode($row->payload));
        expect(Arr::has($claims, 'auth.password_confirmed_at'))->toBeFalse();
    }
});

it('keeps the password-changing cookie live while revoking other sessions and old remember credentials', function (): void {
    [$actor, $password] = cLogin($this);
    $oldCookies = $this->cCookies;
    $this->startIndependentCookieBrowser();
    $this->cCookies = [];
    cHttp($this, 'GET', '/sanctum/csrf-cookie')->assertNoContent();
    cHttp($this, 'POST', '/login', ['email' => $actor->email, 'password' => $password])->assertOk();
    expect(DB::table('sessions')->where('user_id', $actor->id)->count())->toBe(2);
    $changed = Str::password(32);
    cHttp($this, 'PUT', '/user/password', ['current_password' => $password, 'password' => $changed, 'password_confirmation' => $changed])->assertSuccessful();
    cHttp($this, 'GET', '/auth/session')->assertOk()->assertJsonPath('id', $actor->id);
    expect(DB::table('sessions')->where('user_id', $actor->id)->count())->toBe(1);
    $this->startIndependentCookieBrowser();
    $this->cCookies = $oldCookies;
    foreach ($oldCookies as $name => $value) {
        $this->withUnencryptedCookie($name, $value);
    }
    cHttp($this, 'GET', '/auth/session')->assertUnauthorized();
    expect(DB::table('sessions')->where('user_id', $actor->id)->count())->toBe(1);
});

it('revokes all old persisted sessions and remember credentials after a real password reset', function (): void {
    [$actor, $password] = cLogin($this);
    $oldCookies = $this->cCookies;
    Notification::fake();
    $this->startIndependentCookieBrowser();
    $this->cCookies = [];
    cHttp($this, 'GET', '/sanctum/csrf-cookie')->assertNoContent();
    cHttp($this, 'POST', '/forgot-password', ['email' => $actor->email])->assertOk();
    $notice = Notification::sent($actor, ResetPassword::class)->sole();
    $changed = Str::password(32);
    cHttp($this, 'POST', '/reset-password', ['email' => $actor->email, 'token' => $notice->token, 'password' => $changed, 'password_confirmation' => $changed])->assertOk();
    expect(DB::table('sessions')->where('user_id', $actor->id)->count())->toBe(0);
    $this->startIndependentCookieBrowser();
    $this->cCookies = $oldCookies;
    foreach ($oldCookies as $name => $value) {
        $this->withUnencryptedCookie($name, $value);
    }
    cHttp($this, 'GET', '/auth/session')->assertUnauthorized();
    $this->startIndependentCookieBrowser();
    $this->cCookies = [];
    cHttp($this, 'GET', '/sanctum/csrf-cookie')->assertNoContent();
    cHttp($this, 'POST', '/login', ['email' => $actor->email, 'password' => $changed])->assertOk();
    cHttp($this, 'GET', '/auth/session')->assertOk()->assertJsonPath('id', $actor->id);
});
