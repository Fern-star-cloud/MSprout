<?php

use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Laravel\Fortify\Fortify;
use PragmaRX\Google2FA\Google2FA;

function cHttp($test, string $method, string $path, array $body = [])
{
    // Each real cookie request gets fresh request-scoped Fortify controllers/guards,
    // as separate PHP HTTP workers do; only the browser cookies persist.
    app()->forgetScopedInstances();
    foreach (app('router')->getRoutes() as $route) {
        $route->flushController();
    }
    Auth::forgetGuards();
    Auth::shouldUse('web');
    app()->forgetInstance('auth.driver');
    app('session')->forgetDrivers();
    app()->forgetInstance('session.store');
    $response = $test->json($method, $path, $body, isset($test->cCookies['XSRF-TOKEN']) ? ['X-XSRF-TOKEN' => $test->cCookies['XSRF-TOKEN']] : []);
    foreach ($response->headers->getCookies() as $cookie) {
        $test->cCookies[$cookie->getName()] = $cookie->getValue();
        $test->withUnencryptedCookie($cookie->getName(), $cookie->getValue());
    }

    return $response;
}

function cLogin($test, bool $mfa = false): array
{
    $password = Str::password(32);
    $secret = (new Google2FA)->generateSecretKey();
    $actor = User::factory()->create(['password' => $password]);
    if ($mfa) {
        $actor->forceFill(['two_factor_secret' => Fortify::currentEncrypter()->encrypt($secret), 'two_factor_confirmed_at' => now()])->save();
    }
    cHttp($test, 'GET', '/sanctum/csrf-cookie')->assertNoContent();
    cHttp($test, 'POST', '/login', ['email' => $actor->email, 'password' => $password, 'remember' => true])->assertOk();
    if ($mfa) {
        cHttp($test, 'POST', '/two-factor-challenge', ['code' => (new Google2FA)->getCurrentOtp($secret)])->assertNoContent();
    }

    return [$actor->fresh(), $password, $secret];
}
