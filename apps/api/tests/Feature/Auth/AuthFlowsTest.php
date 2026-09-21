<?php

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Laravel\Fortify\Fortify;
use PragmaRX\Google2FA\Google2FA;
use Tests\Support\PostgresTestDatabase;

beforeEach(function () {
    PostgresTestDatabase::refresh();
});

it('keeps cookie names and scopes independent across alternating HTTP requests', function () {
    $church = $this->getJson('/sanctum/csrf-cookie')->assertNoContent();
    $platform = $this->getJson('/platform/csrf-token')->assertOk();
    $cookies = $platform->headers->getCookies();
    expect($cookies[0]->getName())->toBe('ministrysprout_platform_session');
    expect($cookies[0]->getPath())->toBe('/platform');
    $churchAgain = $this->getJson('/sanctum/csrf-cookie')->assertNoContent();
    expect(array_map(fn ($c) => $c->getName(), $churchAgain->headers->getCookies()))->not->toContain('ministrysprout_platform_session');
});

it('verifies email through a signed frontend invitation and rejects tampering', function () {
    Notification::fake();
    $user = User::factory()->unverified()->create();
    $this->actingAs($user)->postJson('/email/verification-notification')->assertStatus(202);
    Notification::assertSentTo($user, VerifyEmail::class, function ($notification) use ($user) {
        $url = $notification->toMail($user)->actionUrl;
        expect(str_contains($url, '/account/verify-email#'))->toBeTrue();
        $signed = rawurldecode(parse_url($url, PHP_URL_FRAGMENT));
        $this->getJson($signed.'x')->assertForbidden();
        $this->getJson($signed)->assertNoContent();

        return true;
    });
    expect($user->fresh()->hasVerifiedEmail())->toBeTrue();
});

it('resets passwords once using emailed tokens', function () {
    Notification::fake();
    $user = User::factory()->create();
    $this->postJson('/forgot-password', ['email' => $user->email])->assertOk();
    Notification::assertSentTo($user, ResetPassword::class, function ($notification) use ($user) {
        $password = Str::password(32);
        $payload = ['email' => $user->email, 'token' => $notification->token, 'password' => $password, 'password_confirmation' => $password];
        $this->postJson('/reset-password', $payload)->assertOk();
        expect(Hash::check($password, $user->fresh()->password))->toBeTrue();
        $this->postJson('/reset-password', $payload)->assertUnprocessable();

        return true;
    });
});

it('enrolls confirmed church TOTP and consumes a recovery code once', function () {
    $password = Str::password(32);
    $user = User::factory()->create(['password' => $password]);
    $this->postJson('/login', ['email' => $user->email, 'password' => $password])->assertOk();
    $this->postJson('/user/confirm-password', ['password' => $password])->assertStatus(201);
    $this->postJson('/user/two-factor-authentication')->assertOk();
    $secret = Fortify::currentEncrypter()->decrypt($user->fresh()->two_factor_secret);
    $this->postJson('/user/confirmed-two-factor-authentication', ['code' => (new Google2FA)->getCurrentOtp($secret)])->assertOk();
    $codes = $this->getJson('/user/two-factor-recovery-codes')->assertOk()->json();
    $this->postJson('/logout')->assertNoContent();
    $this->postJson('/login', ['email' => $user->email, 'password' => $password])->assertJsonPath('two_factor', true);
    $this->postJson('/two-factor-challenge', ['recovery_code' => $codes[0]])->assertNoContent();
    $this->postJson('/logout')->assertNoContent();
    $this->postJson('/login', ['email' => $user->email, 'password' => $password])->assertJsonPath('two_factor', true);
    $this->postJson('/two-factor-challenge', ['recovery_code' => $codes[0]])->assertUnprocessable();
});
