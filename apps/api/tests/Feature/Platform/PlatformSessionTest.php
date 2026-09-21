<?php

use App\Models\PlatformAdmin;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Laravel\Fortify\Fortify;
use PragmaRX\Google2FA\Google2FA;
use Tests\Support\PostgresTestDatabase;

beforeEach(function () {
    PostgresTestDatabase::refresh();
    $this->password = Str::password(32);
});

it('requires signed invitation password TOTP and recovery acknowledgement before activation', function () {
    $admin = PlatformAdmin::factory()->create();
    $url = URL::temporarySignedRoute('platform.setup.show', now()->addMinutes(20), ['platformAdmin' => $admin->id]);
    $enrollment = $this->postJson($url, ['password' => $this->password, 'password_confirmation' => $this->password])
        ->assertOk()->assertJsonStructure(['secret', 'qr_code', 'recovery_codes'])->json();
    expect($admin->fresh()->status)->toBe('pending');
    $this->postJson('/platform/setup/'.$admin->id.'/confirm', ['code' => '000000', 'recovery_codes_acknowledged' => false])->assertUnprocessable();
    $this->postJson('/platform/setup/'.$admin->id.'/confirm', [
        'code' => (new Google2FA)->getCurrentOtp($enrollment['secret']), 'recovery_codes_acknowledged' => true,
    ])->assertNoContent();
    expect($admin->fresh()->status)->toBe('active')->and($admin->fresh()->email_verified_at)->not->toBeNull();
    $this->getJson('/platform/me')->assertExactJson(['handle' => $admin->handle, 'online_only' => true]);
    $this->postJson($url, ['password' => $this->password, 'password_confirmation' => $this->password])->assertGone();
});

it('requires a fresh platform MFA challenge and consumes recovery codes once', function () {
    $secret = (new Google2FA)->generateSecretKey();
    $admin = PlatformAdmin::factory()->create([
        'status' => 'active', 'password' => $this->password, 'email_verified_at' => now(),
        'two_factor_secret' => Fortify::currentEncrypter()->encrypt($secret),
        'two_factor_recovery_codes' => Fortify::currentEncrypter()->encrypt(json_encode(['one-use-recovery'])),
        'two_factor_confirmed_at' => now(), 'recovery_codes_acknowledged_at' => now(),
    ]);
    $this->postJson('/platform/login', ['handle' => $admin->handle, 'password' => $this->password])->assertExactJson(['two_factor' => true]);
    $this->getJson('/platform/me')->assertUnauthorized();
    $this->postJson('/platform/two-factor-challenge', ['recovery_code' => 'one-use-recovery'])->assertNoContent();
    $this->getJson('/platform/me')->assertOk();
    $this->postJson('/platform/logout')->assertNoContent();
    $this->postJson('/platform/login', ['handle' => $admin->handle, 'password' => $this->password])->assertOk();
    $this->postJson('/platform/two-factor-challenge', ['recovery_code' => 'one-use-recovery'])->assertUnprocessable();
});

it('rejects disabled platform sessions and expired invitations', function () {
    $admin = PlatformAdmin::factory()->create(['status' => 'disabled']);
    $this->actingAs($admin, 'platform')->getJson('/platform/me')->assertForbidden();
    $url = URL::temporarySignedRoute('platform.setup.show', now()->subMinute(), ['platformAdmin' => $admin->id]);
    $this->getJson($url)->assertForbidden();
});
