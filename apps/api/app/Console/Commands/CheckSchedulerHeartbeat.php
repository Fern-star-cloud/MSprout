<?php

namespace App\Console\Commands;

use App\Domain\Audit\CorrelationContext;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class CheckSchedulerHeartbeat extends Command
{
    protected $signature = 'operations:scheduler-heartbeat {--check : Fail without recording when the latest heartbeat is stale}';

    protected $description = 'Record or verify the privacy-safe scheduler heartbeat';

    public function handle(): int
    {
        if ($this->option('check')) {
            $healthy = (bool) DB::scalar(
                "SELECT EXISTS (SELECT 1 FROM system_heartbeats WHERE name = 'scheduler' AND status = 'ok' AND last_run_at >= ?)",
                [now('UTC')->subSeconds((int) config('operations.scheduler_stale_seconds'))],
            );

            return $healthy ? self::SUCCESS : self::FAILURE;
        }

        DB::select('SELECT record_system_heartbeat(?, ?, ?, ?, ?)', [
            'scheduler', 'ok', now('UTC'), (string) Str::uuid(), app(CorrelationContext::class)->id(),
        ]);

        return self::SUCCESS;
    }
}
