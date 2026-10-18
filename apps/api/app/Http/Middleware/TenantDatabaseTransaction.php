<?php

namespace App\Http\Middleware;

use App\Domain\Sync\ChurchCoordination;
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
            // Account navigation is fenced by its global User/session boundary;
            // it does not need the exclusive church operation queue.
            fn (): Response => $request->is('api/me')
                ? $next($request)
                : app(ChurchCoordination::class)->run($request, fn (): Response => $next($request)),
        );
    }
}
