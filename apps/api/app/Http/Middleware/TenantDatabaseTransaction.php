<?php

namespace App\Http\Middleware;

use App\Support\Tenancy\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final readonly class TenantDatabaseTransaction
{
    public function __construct(private TenantContext $tenantContext) {}

    public function handle(Request $request, Closure $next): Response
    {
        $churchId = $request->attributes->get(ResolveChurchMembership::REQUEST_ATTRIBUTE);

        if (! is_string($churchId)) {
            abort(403);
        }

        return $this->tenantContext->run(
            $churchId,
            fn (): Response => $next($request),
        );
    }
}
