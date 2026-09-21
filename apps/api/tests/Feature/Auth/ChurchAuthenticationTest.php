<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Fortify\Fortify;
use PragmaRX\Google2FA\Google2FA;
use Tests\Support\ChurchScenario;
use Tests\Support\PostgresTestDatabase;

beforeEach(function (): void {
    PostgresTestDatabase::refresh();
});

it('requires a church session for account metadata', function (): void {
    $this->getJson('/api/me')->assertUnauthorized();
});

it('authenticates through the Fortify session flow without returning a token', function (): void {
    $plainPassword = Str::password(32);
    $user = User::factory()->create([
        'password' => Hash::make($plainPassword),
    ]);

    $response = $this->postJson('/login', [
        'email' => $user->email,
        'password' => $plainPassword,
    ]);

    $response->assertOk()->assertJsonMissingPath('token');
    $this->assertAuthenticatedAs($user);

    $this->postJson('/logout')->assertNoContent();
    $this->assertGuest();
});

it('rejects unverified church users before resolving tenant access', function (): void {
    [$owner, $church] = ChurchScenario::owner();
    $user = User::query()->findOrFail($owner->id);
    $user->forceFill(['email_verified_at' => null])->save();

    $this->actingAs($user)
        ->withHeader('X-Church-Id', $church->id)
        ->getJson('/api/me')
        ->assertForbidden();
});

it('returns only allowlisted account and current membership metadata', function (): void {
    [, $church] = ChurchScenario::owner();
    [$teacher] = ChurchScenario::teacher($church);
    $teacher = User::query()->findOrFail($teacher->id);

    $this->actingAs($teacher)
        ->withHeader('X-Church-Id', $church->id)
        ->getJson('/api/me')
        ->assertOk()
        ->assertExactJson([
            'id' => $teacher->id,
            'display_name' => $teacher->name,
            'email_verified' => true,
            'memberships' => [[
                'church_id' => $church->id,
                'role' => 'teacher',
                'status' => 'active',
            ]],
            'assignments' => [
                'ministry_ids' => [],
            ],
            'active_session' => [
                'mfa_confirmed' => false,
            ],
        ]);
});

it('requires MFA assurance in the current Owner session', function (): void {
    $this->withHeader('Origin', config('app.url'));
    [$owner, $church] = ChurchScenario::owner();
    $owner = User::query()->findOrFail($owner->id);
    $password = Str::password(32);
    $secret = (new Google2FA)->generateSecretKey();
    $owner->forceFill([
        'password' => Hash::make($password),
        'two_factor_secret' => Fortify::currentEncrypter()->encrypt($secret),
        'two_factor_recovery_codes' => Fortify::currentEncrypter()->encrypt(json_encode(['unused-code'])),
        'two_factor_confirmed_at' => now(),
    ])->save();

    $this->actingAs($owner)->withHeader('X-Church-Id', $church->id)
        ->getJson('/api/me')->assertForbidden();
    $this->postJson('/logout')->assertNoContent();
    $this->postJson('/login', ['email' => $owner->email, 'password' => $password])
        ->assertJsonPath('two_factor', true);
    $this->postJson('/two-factor-challenge', ['code' => (new Google2FA)->getCurrentOtp($secret)])
        ->assertNoContent();
    $this->getJson('/api/me')->assertOk()->assertJsonPath('active_session.mfa_confirmed', true);
});
