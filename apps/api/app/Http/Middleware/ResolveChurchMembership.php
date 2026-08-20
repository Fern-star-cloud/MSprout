<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

final class ResolveChurchMembership
{
    public const REQUEST_ATTRIBUTE = 'tenant.church_id';

    public function handle(Request $request, Closure $next): Response
    {
        $churchId = $request->header('X-Church-Id');

        if (! is_string($churchId) || ! Str::isUuid($churchId)) {
            abort(403);
        }

        $request->attributes->set(self::REQUEST_ATTRIBUTE, Str::lower($churchId));

        return $next($request);
    }
}
