<?php

use App\Models\PlatformAdmin;
use App\Models\User;
use Illuminate\Contracts\Debug\ExceptionHandler;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Fortify\Fortify;
use PragmaRX\Google2FA\Google2FA;
use Tests\Support\PostgresTestDatabase;

beforeEach(function () {
    PostgresTestDatabase::refresh();
    $this->encrypted = false;
    $this->browserCookies = [];
    $this->browserRequest = function (string $method, string $path, array $data = [], ?string $csrf = null) {
        // Each request boots new guards and stores, restoring only real encrypted response cookies.
        $this->refreshApplication();
        config(['session.driver' => 'database', 'session.connection' => 'pgsql', 'session.encrypt' => $this->encrypted, 'session.lottery' => [0, 100]]);
        $this->app->instance('env', 'local'); // Exercise CSRF instead of the testing bypass.
        $failure = null;
        // Diagnose test failures without exposing SQL bindings or session payloads.
        app(ExceptionHandler::class)->map(QueryException::class, function ($exception) use (&$failure) {
            $failure = ['exception_type' => get_class($exception), 'sqlstate' => $exception->errorInfo[0] ?? null];

            return $exception;
        });
        $cookies = [];
        foreach ($this->browserCookies as $cookie) {
            if ($cookie->getPath() === '/' || str_starts_with($path, $cookie->getPath().'/')) {
                $cookies[$cookie->getName()] = $cookie->getValue();
            }
        }
        $response = $this->call($method, $path, cookies: $cookies, server: [
            'HTTP_ACCEPT' => 'application/json', 'CONTENT_TYPE' => 'application/json',
            'HTTP_X_CSRF_TOKEN' => $csrf ?? '',
        ], content: json_encode($data));
        expect($failure)->toBeNull();
        foreach ($response->headers->getCookies() as $cookie) {
            if (str_starts_with($path, '/platform/')) {
                expect($cookie->getName())->toBe('ministrysprout_platform_session');
                expect($cookie->getPath())->toBe('/platform');
                expect($cookie->isHttpOnly())->toBeTrue();
            } else {
                expect($cookie->getName())->not->toBe('ministrysprout_platform_session');
                expect($cookie->getPath())->toBe('/');
            }
            $this->browserCookies[$cookie->getName()] = $cookie;
        }

        return $response;
    };
});

it('restores a platform administrator after password and TOTP across fresh database session requests', function (bool $encrypted) {
    $this->encrypted = $encrypted;
    $password = Str::password(32);
    $secret = (new Google2FA)->generateSecretKey();
    $admin = PlatformAdmin::factory()->create([
        'status' => 'active', 'password' => $password, 'email_verified_at' => now(),
        'two_factor_secret' => Fortify::currentEncrypter()->encrypt($secret),
        'two_factor_confirmed_at' => now(), 'recovery_codes_acknowledged_at' => now(),
    ]);
    $request = $this->browserRequest;
    $csrf = $request('GET', '/platform/csrf-token')->assertOk()->json('csrf_token');
    $request('POST', '/platform/login', ['handle' => $admin->handle, 'password' => $password], $csrf)
        ->assertOk()->assertExactJson(['two_factor' => true]);
    $request('GET', '/platform/me')->assertUnauthorized();
    $csrf = $request('GET', '/platform/csrf-token')->assertOk()->json('csrf_token');
    $oldId = session()->getId();
    $request('POST', '/platform/two-factor-challenge', ['code' => (new Google2FA)->getCurrentOtp($secret)], $csrf)->assertNoContent();
    expect(session()->getId() !== $oldId)->toBeTrue();
    expect(DB::table('sessions')->where('id', $oldId)->exists())->toBeFalse();
    $request('GET', '/platform/me')->assertOk()->assertExactJson(['handle' => $admin->handle, 'online_only' => true])
        ->assertHeader('Cache-Control', 'no-store, private');
    expect(Auth::guard('platform')->user())->toBeInstanceOf(PlatformAdmin::class);
    expect(Auth::guard('platform')->id())->toBe($admin->id);
    expect(Auth::guard('web')->check())->toBeFalse();
    $persistedSession = DB::table('sessions')->where('id', session()->getId())->first(['user_id']);
    expect($persistedSession)->not->toBeNull();
    expect($persistedSession?->user_id)->toBeNull();
    $admin->forceFill(['status' => 'disabled'])->save();
    $request('GET', '/platform/me')->assertForbidden();
})->with([false, true]);

it('persists church integer metadata and isolates both authenticated browser cookies and CSRF tokens', function () {
    $password = Str::password(32);
    $user = User::factory()->create(['password' => $password]);
    $secret = (new Google2FA)->generateSecretKey();
    $admin = PlatformAdmin::factory()->create([
        'status' => 'active', 'password' => $password, 'email_verified_at' => now(),
        'two_factor_secret' => Fortify::currentEncrypter()->encrypt($secret),
        'two_factor_confirmed_at' => now(), 'recovery_codes_acknowledged_at' => now(),
    ]);
    $request = $this->browserRequest;
    $request('GET', '/sanctum/csrf-cookie')->assertNoContent();
    $request('POST', '/login', ['email' => $user->email, 'password' => $password], session()->token())->assertOk();
    $request('GET', '/auth/session')->assertOk()->assertExactJson(['id' => $user->id, 'email_verified' => true, 'mfa_confirmed' => false, 'workspaces' => []]);
    $churchCsrf = session()->token();
    $churchId = session()->getId();
    expect((int) DB::table('sessions')->where('id', $churchId)->value('user_id'))->toBe($user->id);
    $request('GET', '/platform/me')->assertUnauthorized();
    $csrf = $request('GET', '/platform/csrf-token')->assertOk()->json('csrf_token');
    $request('POST', '/platform/login', ['handle' => $admin->handle, 'password' => $password], $csrf)->assertOk();
    $csrf = $request('GET', '/platform/csrf-token')->assertOk()->json('csrf_token');
    $request('POST', '/platform/two-factor-challenge', ['code' => (new Google2FA)->getCurrentOtp($secret)], $csrf)->assertNoContent();
    $request('GET', '/auth/session')->assertOk();
    expect(Auth::guard('web')->id())->toBe($user->id);
    expect(Auth::guard('platform')->check())->toBeFalse();
    expect(session()->getId() === $churchId)->toBeTrue();
    $request('GET', '/platform/me')->assertOk()->assertExactJson(['handle' => $admin->handle, 'online_only' => true]);
    $request('POST', '/platform/logout', csrf: $churchCsrf)->assertStatus(419);
    $csrf = $request('GET', '/platform/csrf-token')->assertOk()->json('csrf_token');
    $request('POST', '/platform/logout', csrf: $csrf)->assertNoContent();
    $request('GET', '/platform/me')->assertUnauthorized();
    $request('GET', '/auth/session')->assertOk();
    expect(Auth::guard('web')->id())->toBe($user->id);
    expect((int) DB::table('sessions')->where('id', $churchId)->value('user_id'))->toBe($user->id);
});
