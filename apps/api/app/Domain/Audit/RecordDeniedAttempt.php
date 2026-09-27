<?php

namespace App\Domain\Audit;

use Illuminate\Support\Facades\Log;
use Throwable;

final class RecordDeniedAttempt
{
    public function record(string $action, string $result = 'denied', string $actorType = 'anonymous', ?string $actorId = null): bool
    {
        try {
            app(SecurityEventWriter::class)->record($action, $result, $actorType, $actorId);

            return true;
        } catch (Throwable) {
            // Denial has already happened. Telemetry availability must not change its outcome.
            try {
                Log::error('Application operation failed.', ['correlation_id' => app(CorrelationContext::class)->id()]);
            } catch (Throwable) {
                // The logging transport is also unavailable; never recursively report its exception.
            }

            return false;
        }
    }
}
