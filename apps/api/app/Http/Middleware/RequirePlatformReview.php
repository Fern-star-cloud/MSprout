<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

final class RequirePlatformReview
{
    public function handle(Request $request, Closure $next)
    {
        $admin = $request->user('platform');
        abort_unless($admin && $admin->handle === 'sage.dev' && $admin->status === 'active'
            && $admin->email_verified_at && $admin->hasEnabledTwoFactorAuthentication()
            && $admin->recovery_codes_acknowledged_at && $request->session()->get('platform.mfa') === true, 403);

        return $next($request);
    }
}
