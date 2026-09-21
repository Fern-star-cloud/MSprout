<?php

namespace App\Support\Captcha;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

final class TurnstileVerifier implements CaptchaVerifier
{
    public function verify(#[\SensitiveParameter] string $token): bool
    {
        $secret = config('applications.captcha_secret');
        $hostname = config('applications.captcha_hostname');
        if (! is_string($secret) || $secret === '' || ! is_string($hostname) || $hostname === '') {
            return false;
        }
        try {
            $response = Http::asForm()->timeout(10)->connectTimeout(3)->post('https://challenges.cloudflare.com/turnstile/v0/siteverify', [
                'secret' => $secret, 'response' => $token,
            ]);

            return $response->successful() && $response->json('success') === true
                && $response->json('hostname') === $hostname && $response->json('action') === 'church_application';
        } catch (ConnectionException) {
            // Never report an upstream exception that may contain CAPTCHA credentials.
            return false;
        }
    }
}
