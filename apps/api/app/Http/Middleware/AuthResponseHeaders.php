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
        if (! $request->is('api/health')) {
            $response->headers->set('Cache-Control', 'no-store, private');
            $response->headers->set('Referrer-Policy', 'no-referrer');
        }

        return $response;
    }
}
