<?php

namespace App\Http\Middleware;

use App\Enums\ChurchRole;
use App\Support\Tenancy\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final readonly class RequireConfirmedOwnerMfa
{
    public function __construct(private TenantContext $tenantContext) {}

    public function handle(Request $request, Closure $next): Response
    {
        if ($this->tenantContext->role() === ChurchRole::Owner
            && (! $request->user()?->hasEnabledTwoFactorAuthentication()
                || ! $request->hasSession()
                || $request->session()->get('church_mfa_user_id') !== $request->user()->getKey())) {
            abort(403);
        }

        return $next($request);
    }
}
