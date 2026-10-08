<?php

use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\Support\PostgresTestDatabase;

beforeEach(function (): void {
    PostgresTestDatabase::refresh();
    config(['session.driver' => 'database']);
    app('session')->forgetDrivers();
    app()->forgetInstance('session.store');
    // Exercise real CSRF middleware and cookie-backed requests in the isolated test database.
    $this->app->instance('env', 'local');
    $this->withCredentials()->withHeader('Origin', config('app.url'));
});

function acceptProfileRecoveryCookies(TestResponse $response): void
{
    foreach ($response->headers->getCookies() as $cookie) {
        if (in_array($cookie->getName(), [config('session.cookie'), 'XSRF-TOKEN'], true)) {
            test()->withUnencryptedCookie($cookie->getName(), $cookie->getValue());
        }
    }
    // A subsequent request must authenticate from its cookie, not a cached test guard.
    Auth::forgetGuards();
    app('session')->forgetDrivers();
    app()->forgetInstance('session.store');
}

function initializeProfileRecoveryCsrf(): string
{
    $response = test()->getJson('/sanctum/csrf-cookie')->assertNoContent();
    acceptProfileRecoveryCookies($response);

    return collect($response->headers->getCookies())->first(fn ($cookie) => $cookie->getName() === 'XSRF-TOKEN')->getValue();
}

it('invalidates a freshly signed-in cookie session immediately on profile-switch logout and permits sign-in afterward', function (): void {
    $this->freezeTime();
    $password = Str::password(32);
    $user = User::factory()->create(['password' => $password]);
    $csrf = initializeProfileRecoveryCsrf();
    $login = $this->postJson('/login', ['email' => $user->email, 'password' => $password], ['X-XSRF-TOKEN' => $csrf])->assertOk();
    acceptProfileRecoveryCookies($login);
    $sessionCookie = collect($login->headers->getCookies())->first(fn ($cookie) => $cookie->getName() === config('session.cookie'));
    expect($sessionCookie !== null)->toBeTrue();
    expect($sessionCookie->isHttpOnly())->toBeTrue();
    expect($sessionCookie->getPath())->toBe('/');

    for ($read = 0; $read < 3; $read++) {
        acceptProfileRecoveryCookies($this->getJson('/auth/session')->assertOk()->assertJsonPath('id', $user->id));
    }
    // The session has not aged; the explicit logout alone must invalidate it.
    $csrf = initializeProfileRecoveryCsrf();
    $logout = $this->postJson('/logout', [], ['X-XSRF-TOKEN' => $csrf])->assertNoContent();
    acceptProfileRecoveryCookies($logout);
    $this->getJson('/auth/session')->assertUnauthorized()->assertHeader('Cache-Control', 'no-store, private');

    $csrf = initializeProfileRecoveryCsrf();
    acceptProfileRecoveryCookies($this->postJson('/login', ['email' => $user->email, 'password' => $password], ['X-XSRF-TOKEN' => $csrf])->assertOk());
    $this->getJson('/auth/session')->assertOk()->assertJsonPath('id', $user->id);
});

it('rejects a logout with missing CSRF without treating the session as unauthenticated', function (): void {
    $password = Str::password(32);
    $user = User::factory()->create(['password' => $password]);
    $csrf = initializeProfileRecoveryCsrf();
    acceptProfileRecoveryCookies($this->postJson('/login', ['email' => $user->email, 'password' => $password], ['X-XSRF-TOKEN' => $csrf])->assertOk());
    $this->postJson('/logout')->assertStatus(419);
    app('session')->forgetDrivers();
    app()->forgetInstance('session.store');
    Auth::forgetGuards();
    $this->getJson('/auth/session')->assertOk()->assertJsonPath('id', $user->id);
});

it('denies an expired database session without requiring a logout', function (): void {
    $password = Str::password(32);
    $user = User::factory()->create(['password' => $password]);
    $csrf = initializeProfileRecoveryCsrf();
    acceptProfileRecoveryCookies($this->postJson('/login', ['email' => $user->email, 'password' => $password], ['X-XSRF-TOKEN' => $csrf])->assertOk());
    $this->getJson('/auth/session')->assertOk()->assertJsonPath('id', $user->id);
    $this->travel(config('session.lifetime') + 1)->minutes();
    app('session')->forgetDrivers();
    app()->forgetInstance('session.store');
    Auth::forgetGuards();
    $this->getJson('/auth/session')->assertUnauthorized();
});
