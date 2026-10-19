<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

final class RejectMaintenanceHttp
{
    public function handle(Request $request, Closure $next): mixed
    {
        $maintenance = config('maintenance.role');
        abort_if(config('maintenance.process') === true || ($maintenance && config('database.connections.pgsql.username') === $maintenance), 503);

        return $next($request);
    }
}
