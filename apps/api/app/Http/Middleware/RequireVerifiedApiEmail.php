<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Auth\Middleware\EnsureEmailIsVerified;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\Request;

class RequireVerifiedApiEmail extends EnsureEmailIsVerified
{
    /** @param Request $request */
    public function handle($request, Closure $next, $redirectToRoute = null)
    {
        if ($request->is('api/*')) {
            $user = $request->user();
            abort_if($user === null || ($user instanceof MustVerifyEmail && ! $user->hasVerifiedEmail()), 403);

            return $next($request);
        }

        return parent::handle($request, $next, $redirectToRoute);
    }
}
