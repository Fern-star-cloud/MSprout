<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

final class AuthResponseHeaders
{
    public function handle(Request $request, Closure $next)
    {
        if ($request->is('forgot-password', 'reset-password') && $request->isMethod('POST')) {
            $key = 'auth-recovery|'.$request->ip();
            abort_if(RateLimiter::tooManyAttempts($key, 5), 429);
            RateLimiter::hit($key, 60);
        }
        $response = $next($request);
        $response->headers->set('Cache-Control', $request->is('health/live') ? 'no-store' : 'no-store, private');
        $response->headers->set('Content-Security-Policy', "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
        $response->headers->set('Permissions-Policy', 'camera=(), geolocation=(), microphone=(), payment=(), usb=()');
        $response->headers->set('Referrer-Policy', 'no-referrer');
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'DENY');
        if (app()->environment('production') && $request->isSecure()) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        return $response;
    }
}
