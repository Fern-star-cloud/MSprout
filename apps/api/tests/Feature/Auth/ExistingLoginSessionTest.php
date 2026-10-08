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
    $this->app->instance('env', 'local');
    $this->withCredentials()->withHeader('Origin', config('app.url'));
});

function retainExistingLoginCookies(TestResponse $response): string
{
    $csrf = '';
    foreach ($response->headers->getCookies() as $cookie) {
        if (in_array($cookie->getName(), [config('session.cookie'), 'XSRF-TOKEN'], true)) {
            test()->withUnencryptedCookie($cookie->getName(), $cookie->getValue());
            if ($cookie->getName() === 'XSRF-TOKEN') {
                $csrf = $cookie->getValue();
            }
        }
    }
    Auth::forgetGuards();
    app('session')->forgetDrivers();
    app()->forgetInstance('session.store');

    return $csrf;
}

function signInExistingLoginUser(): User
{
    $password = Str::password(32);
    $user = User::factory()->create(['password' => $password]);
    $csrf = retainExistingLoginCookies(test()->getJson('/sanctum/csrf-cookie')->assertNoContent());
    retainExistingLoginCookies(test()->postJson('/login', ['email' => $user->email, 'password' => $password], ['X-XSRF-TOKEN' => $csrf])->assertOk());

    return $user;
}

it('retains the framework HTML redirect for an already authenticated login', function (): void {
    $user = signInExistingLoginUser();
    $csrf = retainExistingLoginCookies($this->getJson('/sanctum/csrf-cookie')->assertNoContent());
    retainExistingLoginCookies($this->post('/login', [], ['Accept' => 'text/html', 'X-XSRF-TOKEN' => $csrf])->assertRedirect('/'));
    $this->getJson('/auth/session')->assertOk()->assertJsonPath('id', $user->id);
});

it('reports an existing cookie session without redirecting JSON login or authenticating submitted credentials', function (): void {
    $this->freezeTime();
    $user = signInExistingLoginUser();
    $csrf = retainExistingLoginCookies($this->getJson('/sanctum/csrf-cookie')->assertNoContent());
    $response = $this->postJson('/login', ['email' => 'different@example.test', 'password' => Str::password(32)], ['X-XSRF-TOKEN' => $csrf])
        ->assertStatus(409)->assertJsonPath('code', 'already_authenticated')
        ->assertHeaderMissing('Location')->assertHeader('Cache-Control', 'no-store, private')
        ->assertJsonStructure(['code', 'message', 'correlation_id'])->assertJsonMissingPath('id');
    retainExistingLoginCookies($response);
    $this->getJson('/auth/session')->assertOk()->assertJsonPath('id', $user->id);
    $this->getJson('/platform/me')->assertUnauthorized();
});

it('requires CSRF even when JSON login encounters an existing session', function (): void {
    $user = signInExistingLoginUser();
    retainExistingLoginCookies($this->postJson('/login', [])->assertStatus(419));
    $this->getJson('/auth/session')->assertOk()->assertJsonPath('id', $user->id);
});
