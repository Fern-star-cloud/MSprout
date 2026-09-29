<?php

namespace App\Http\Controllers\Platform;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Throwable;

final class SystemHealthController extends Controller
{
    public function readiness(Request $request): JsonResponse
    {
        $expected = config('operations.readiness_token');
        $provided = $request->header('X-Readiness-Token');
        abort_unless(is_string($expected) && $expected !== '' && is_string($provided) && hash_equals($expected, $provided), 401);

        try {
            $health = $this->metrics();
            $checks = [
                'api' => 'ok',
                'database' => $health['database']['status'],
                'queue' => $health['queue']['status'],
                'scheduler' => $health['scheduler']['status'],
            ];
            $ready = ! in_array('degraded', $checks, true);

            return response()->json(['status' => $ready ? 'ready' : 'degraded', 'checks' => $checks], $ready ? 200 : 503);
        } catch (Throwable) {
            return response()->json([
                'status' => 'unavailable',
                'checks' => ['api' => 'ok', 'database' => 'unavailable', 'queue' => 'unknown', 'scheduler' => 'unknown'],
            ], 503);
        }
    }

    public function dashboard(): JsonResponse
    {
        return response()->json($this->metrics());
    }

    /** @return array<string, mixed> */
    private function metrics(): array
    {
        $value = DB::scalar('SELECT system_health_metrics(?, ?)', [
            config('operations.queue_lag_warning_seconds'),
            config('operations.scheduler_stale_seconds'),
        ]);
        $metrics = is_string($value) ? json_decode($value, true, flags: JSON_THROW_ON_ERROR) : $value;
        if (! is_array($metrics)) {
            throw new \RuntimeException('Health metrics are unavailable.');
        }

        return $metrics;
    }
}
