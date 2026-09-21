<?php

use App\Actions\Memberships\RecordMembershipAudit;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Fortify\Contracts\TwoFactorAuthenticationProvider;
use PragmaRX\Google2FA\Google2FA;
use Tests\Support\ChurchScenario;
use Tests\Support\MembershipScenario;
use Tests\Support\PostgresTestDatabase;

beforeEach(function () {
    PostgresTestDatabase::refresh();
    [$this->owner, $this->church, $this->membership] = MembershipScenario::owner($this);
    [, $this->target] = ChurchScenario::teacher($this->church);
});

it('requires a fresh MFA challenge password and explicit active Teacher', function () {
    $payload = ['target_membership_id' => $this->target->id, 'password' => $this->password, 'code' => (new Google2FA)->getCurrentOtp($this->secret)];
    $this->postJson('/api/ownership-transfer', array_replace($payload, ['password' => 'incorrect']))->assertUnprocessable();
    $this->postJson('/api/ownership-transfer', array_replace($payload, ['code' => '000000']))->assertUnprocessable();
    $this->postJson('/api/ownership-transfer', array_replace($payload, ['target_membership_id' => $this->membership->id]))->assertNotFound();
    [, $otherChurch] = ChurchScenario::owner();
    [, $foreign] = ChurchScenario::teacher($otherChurch);
    $this->postJson('/api/ownership-transfer', array_replace($payload, ['target_membership_id' => $foreign->id]))->assertNotFound();
    $this->postJson('/api/ownership-transfer', $payload)->assertNoContent();
    $rows = DB::connection('pgsql_migration')->table('church_memberships')->where('church_id', $this->church->id);
    expect((clone $rows)->where('role', 'owner')->where('status', 'active')->pluck('id')->all())->toBe([$this->target->id]);
    expect((clone $rows)->where('id', $this->membership->id)->value('role'))->toBe('teacher');
    expect(DB::connection('pgsql_migration')->table('membership_audits')->where('action', 'ownership.transferred')->count())->toBe(1);
    $this->travel(61)->seconds();
    $this->postJson('/api/ownership-transfer', $payload)->assertUnauthorized();
});

it('rejects missing stale and previously consumed MFA challenges', function () {
    $payload = ['target_membership_id' => $this->target->id, 'password' => $this->password];
    $this->postJson('/api/ownership-transfer', $payload)->assertUnprocessable();
    // Google2FA uses the system clock, not Carbon's test clock.
    $stale = (new Google2FA)->oathTotp($this->secret, (int) floor(time() / 30) - 10);
    $this->postJson('/api/ownership-transfer', $payload + ['code' => $stale])->assertUnprocessable();
    $code = (new Google2FA)->getCurrentOtp($this->secret);
    app(TwoFactorAuthenticationProvider::class)->verify($this->secret, $code);
    $this->postJson('/api/ownership-transfer', $payload + ['code' => $code])->assertUnprocessable();
    expect(DB::connection('pgsql_migration')->table('membership_audits')->count())->toBe(0);
});

it('immediately signs out the former Owner and rejects every old database session cookie', function () {
    config(['session.driver' => 'database', 'session.connection' => 'pgsql', 'session.encrypt' => false]);
    $guardKey = Auth::guard('web')->getName();
    $sessionIds = [Str::random(40), Str::random(40)];
    foreach ($sessionIds as $id) {
        DB::table('sessions')->insert([
            'id' => $id, 'user_id' => $this->owner->id, 'last_activity' => time(),
            'payload' => base64_encode(json_encode([
                $guardKey => $this->owner->id,
                'church_mfa_user_id' => $this->owner->id,
                'password_hash_web' => $this->owner->password,
            ])),
        ]);
    }
    $freshRequest = function (string $id) {
        app('session')->forgetDrivers();
        app()->forgetInstance('session.store');
        Auth::forgetGuards();
        app()->forgetInstance('auth.driver');
        Auth::shouldUse('web');
        $this->withCookie(config('session.cookie'), $id)->withCredentials();
    };
    $freshRequest($sessionIds[0]);
    $this->getJson('/api/me')->assertOk()->assertJsonPath('memberships.0.role', 'owner');
    $freshRequest($sessionIds[0]);
    $previousRememberToken = $this->owner->getRememberToken();
    $this->postJson('/api/ownership-transfer', [
        'target_membership_id' => $this->target->id, 'password' => $this->password,
        'code' => (new Google2FA)->getCurrentOtp($this->secret),
    ])->assertNoContent();
    $this->assertGuest('web');
    expect(session()->has('church_mfa_user_id'))->toBeFalse();
    expect(DB::table('sessions')->where('user_id', $this->owner->id)->count())->toBe(0);
    expect($this->owner->fresh()->getRememberToken())->not->toBe($previousRememberToken);
    foreach ($sessionIds as $id) {
        $freshRequest($id);
        $this->getJson('/api/me')->assertUnauthorized();
    }
});

it('rejects inactive targets and requires the promoted Owner to establish MFA', function () {
    DB::connection('pgsql_migration')->table('church_memberships')->where('id', $this->target->id)->update(['status' => 'revoked']);
    $payload = ['target_membership_id' => $this->target->id, 'password' => $this->password, 'code' => (new Google2FA)->getCurrentOtp($this->secret)];
    $this->postJson('/api/ownership-transfer', $payload)->assertNotFound();
    DB::connection('pgsql_migration')->table('church_memberships')->where('id', $this->target->id)->update(['status' => 'active']);
    MembershipScenario::deviceAccess($this->target);
    $this->postJson('/api/ownership-transfer', $payload)->assertNoContent();
    $user = User::findOrFail($this->target->user_id);
    $this->actingAs($user, 'web')->withSession(['password_hash_web' => $user->password])->getJson('/api/me')->assertForbidden();
    expect(DB::connection('pgsql_migration')->table('offline_authorizations')->whereNull('revoked_at')->count())->toBe(0);
});

it('rolls back both roles when required audit persistence fails', function () {
    MembershipScenario::deviceAccess($this->membership);
    MembershipScenario::deviceAccess($this->target);
    $rememberToken = $this->owner->getRememberToken();
    $this->mock(RecordMembershipAudit::class)->shouldReceive('handle')->andThrow(new RuntimeException('audit unavailable'));
    $this->postJson('/api/ownership-transfer', ['target_membership_id' => $this->target->id, 'password' => $this->password, 'code' => (new Google2FA)->getCurrentOtp($this->secret)])->assertStatus(500);
    $rows = DB::connection('pgsql_migration')->table('church_memberships')->where('church_id', $this->church->id);
    expect((clone $rows)->where('role', 'owner')->pluck('id')->all())->toBe([$this->membership->id]);
    expect((clone $rows)->where('id', $this->target->id)->value('role'))->toBe('teacher');
    expect(DB::table('sessions')->whereIn('user_id', [$this->owner->id, $this->target->user_id])->count())->toBe(2);
    expect($this->owner->fresh()->getRememberToken())->toBe($rememberToken);
    foreach (['offline_authorizations', 'push_subscriptions'] as $table) {
        expect(DB::connection('pgsql_migration')->table($table)->whereNull('revoked_at')->count())->toBe(2);
    }
    expect(DB::connection('pgsql_migration')->table('membership_audits')->count())->toBe(0);
    $this->assertAuthenticatedAs($this->owner, 'web');
    $this->getJson('/api/me')->assertOk()->assertJsonPath('memberships.0.role', 'owner');
});
