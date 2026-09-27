<?php

namespace App\Http\Middleware;

use App\Domain\Audit\CorrelationContext;
use App\Domain\Audit\RecordDeniedAttempt;
use Closure;
use Illuminate\Http\Request;

final class CorrelationId
{
    public function handle(Request $request, Closure $next)
    {
        $context = app(CorrelationContext::class);
        $id = $context->start($request->header('X-Correlation-Id'));
        $request->headers->set('X-Correlation-Id', $id);
        try {
            $response = $next($request);
            if (in_array($response->getStatusCode(), [401, 403, 419, 429], true)
                && ! $request->attributes->get('audit.security_event_recorded', false)) {
                // Outside the tenant transaction: a denial must survive domain rollback. Never trust a denied church header.
                $platform = $request->is('platform/*');
                $actor = $request->user($platform ? 'platform' : 'web');
                app(RecordDeniedAttempt::class)->record(
                    $response->getStatusCode() === 429 ? 'access.rate_limited' : 'access.denied',
                    actorType: $actor === null ? 'anonymous' : ($platform ? 'platform_admin' : 'user'),
                    actorId: $actor === null ? null : (string) $actor->getAuthIdentifier(),
                );
            }
            $response->headers->set('X-Correlation-Id', $id);

            return $response;
        } finally {
            $context->clear();
        }
    }
}
