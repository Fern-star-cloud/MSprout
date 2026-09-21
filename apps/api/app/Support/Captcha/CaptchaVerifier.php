<?php

namespace App\Support\Captcha;

interface CaptchaVerifier
{
    public function verify(#[\SensitiveParameter] string $token): bool;
}
