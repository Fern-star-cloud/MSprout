<?php

namespace App\Jobs;

use App\Domain\Audit\AuditEntry;
use App\Domain\Audit\AuditWriter;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;

final class PruneOperationalData implements ShouldQueue
{
    use Queueable;

    public function handle(AuditWriter $audit): void
    {
        DB::transaction(function () use ($audit): void {
            $value = DB::scalar('SELECT prune_operational_data(?, ?, ?, ?)', [
                now('UTC')->subDays((int) config('operations.operational_retention_days')),
                now('UTC')->subDays((int) config('operations.security_retention_days')),
                now('UTC')->subDays((int) config('operations.sync_receipt_retention_days')),
                now('UTC')->subDays((int) config('operations.change_feed_retention_days')),
            ]);
            $counts = is_string($value) ? json_decode($value, true, flags: JSON_THROW_ON_ERROR) : $value;
            $purgedApplications = app(PurgeRejectedApplications::class)->handle();
            $total = array_sum(array_map('intval', is_array($counts) ? $counts : [])) + $purgedApplications;
            $audit->record(new AuditEntry('platform', 'operations.retention.pruned', 'system', null, 'system', null, 'success', metadata: ['count' => $total]));

        });
    }
}
