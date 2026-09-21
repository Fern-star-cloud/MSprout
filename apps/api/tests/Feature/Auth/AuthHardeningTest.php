<?php

use App\Mail\PlatformAdminSetupMail;
use App\Models\PlatformAdmin;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Notification;
use Tests\Support\PostgresTestDatabase;

beforeEach(function () {
    PostgresTestDatabase::refresh();
});

it('returns generic recovery responses and frontend reset links', function () {
    Notification::fake();
    $user = User::factory()->create();
    $known = $this->postJson('/forgot-password', ['email' => $user->email])->assertOk();
    $unknown = $this->postJson('/forgot-password', ['email' => 'missing@example.com'])->assertOk();
    expect($known->json())->toBe($unknown->json());
    Notification::assertSentTo($user, ResetPassword::class, function ($notification) use ($user) {
        expect($notification->toMail($user)->actionUrl)->toContain('/account/reset-password#');

        return true;
    });
});

it('exposes only enrollment state without tenant selection and disables registration', function () {
    $this->actingAs(User::factory()->unverified()->create())->getJson('/auth/session')
        ->assertExactJson(['email_verified' => false, 'mfa_confirmed' => false]);
    $this->postJson('/register', [])->assertNotFound();
});

it('returns safe JSON and no store for church errors and rate limits', function () {
    $this->postJson('/login', [])->assertUnprocessable()->assertJsonPath('code', 'validation_failed')->assertHeader('Cache-Control', 'no-store, private');
    for ($i = 0; $i < 6; $i++) {
        $response = $this->postJson('/login', ['email' => 'limited@example.com', 'password' => 'invalid']);
    }
    $response->assertStatus(429)->assertJsonPath('code', 'rate_limited');
});

it('enforces real CSRF middleware on both login surfaces', function () {
    $this->app->instance('env', 'local');
    $this->postJson('/login', [])->assertStatus(419)->assertJsonPath('code', 'csrf_mismatch');
    $this->postJson('/platform/login', [])->assertStatus(419)->assertJsonPath('code', 'csrf_mismatch');
});

it('sends setup invitations through the frontend without query string secrets', function () {
    $admin = PlatformAdmin::factory()->create();
    $mail = new PlatformAdminSetupMail($admin);
    expect($mail->content()->with['setupUrl'])->toContain('/account/platform-setup#')->not->toContain('?signature=');
});

it('throttles recovery requests independently of account existence', function () {
    for ($i = 0; $i < 6; $i++) {
        $response = $this->postJson('/forgot-password', ['email' => 'unknown'.$i.'@example.com']);
    }
    $response->assertStatus(429)->assertJsonPath('code', 'rate_limited');
});

it('never accepts a platform identity on church routes', function () {
    $admin = PlatformAdmin::factory()->create(['status' => 'active']);
    $this->actingAs($admin, 'platform')->getJson('/api/me')->assertUnauthorized();
    $this->getJson('/auth/session')->assertUnauthorized();
});
