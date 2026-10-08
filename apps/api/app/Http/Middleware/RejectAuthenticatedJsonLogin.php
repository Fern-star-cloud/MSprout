<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Auth\Middleware\RedirectIfAuthenticated;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

final class RejectAuthenticatedJsonLogin extends RedirectIfAuthenticated
{
    public function handle(Request $request, Closure $next, string ...$guards): Response
    {
        // Preserve the guest boundary: submitted credentials must never replace an active identity.
        if ($request->is('login') && $request->isMethod('POST') && $request->expectsJson()
            && in_array('web', $guards, true) && Auth::guard('web')->check()) {
            return response()->json([
                'code' => 'already_authenticated',
                'message' => 'A session is already signed in. Check that session or sign out before using another account.',
                'correlation_id' => $request->header('X-Correlation-Id'),
            ], 409);
        }

        return parent::handle($request, $next, ...$guards);
    }
}
