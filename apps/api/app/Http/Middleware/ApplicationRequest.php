<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

final class ApplicationRequest
{
    public function handle(Request $request, Closure $next)
    {
        $id = $request->header('X-Correlation-Id');
        $request->headers->set('X-Correlation-Id', Str::isUuid($id) ? $id : (string) Str::uuid());
        abort_if($request->allFiles() !== [], 422);
        $response = $next($request);
        $response->headers->set('X-Correlation-Id', $request->header('X-Correlation-Id'));

        return $response;
    }
}
