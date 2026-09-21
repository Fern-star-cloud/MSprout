<?php

use App\Support\Captcha\TurnstileVerifier;
use Illuminate\Support\Facades\Http;

it('fails closed for missing configuration invalid host action and upstream failure', function () {
    Http::preventStrayRequests();
    config(['applications.captcha_secret' => null]);
    expect((new TurnstileVerifier)->verify('test'))->toBeFalse();
    Http::assertNothingSent();
    config(['applications.captcha_secret' => 'test-secret', 'applications.captcha_hostname' => 'example.test']);
    foreach ([['success' => false], ['success' => true, 'hostname' => 'attacker.test', 'action' => 'church_application'], ['success' => true, 'hostname' => 'example.test', 'action' => 'other']] as $body) {
        Http::fake(['challenges.cloudflare.com/*' => Http::response($body)]);
        expect((new TurnstileVerifier)->verify('test'))->toBeFalse();
    }
    Http::fake(['challenges.cloudflare.com/*' => Http::failedConnection()]);
    expect((new TurnstileVerifier)->verify('test'))->toBeFalse();
});

it('verifies a valid server challenge without contacting a real service', function () {
    config(['applications.captcha_secret' => 'test-secret', 'applications.captcha_hostname' => 'example.test']);
    Http::fake(['challenges.cloudflare.com/*' => Http::response(['success' => true, 'hostname' => 'example.test', 'action' => 'church_application'])]);
    expect((new TurnstileVerifier)->verify('test'))->toBeTrue();
    Http::assertSentCount(1);
});
