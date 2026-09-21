<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;

final class ValidatePlatformCsrfToken extends PreventRequestForgery
{
    protected $addHttpCookie = false;
}
