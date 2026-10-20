<?php

namespace App\Jobs;

use App\Domain\Audit\AuditEntry;
use App\Domain\Audit\AuditWriter;
use App\Domain\Sync\MaintenanceCoordinator;
use App\Domain\Sync\RecoverySnapshotRetention;
use App\Domain\Sync\TrustedSystemPurpose;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;

final class PruneOperationalData implements ShouldQueue
{
    use Queueable;

    public function handle(AuditWriter $audit): void
    {
        $coordinator = app(MaintenanceCoordinator::class);
        $coordinator->assertWorker();
        $total = DB::transaction(function () use ($audit): int {
            $value = DB::scalar('SELECT public.prune_global_operational_data(?, ?)', [
                now('UTC')->subDays((int) config('operations.operational_retention_days')),
                now('UTC')->subDays((int) config('operations.security_retention_days')),
            ]);
            $counts = is_string($value) ? json_decode($value, true, flags: JSON_THROW_ON_ERROR) : $value;
            $count = array_sum(array_map('intval', $counts));
            $audit->record(new AuditEntry('platform', 'operations.global_retention.pruned', 'system', null, 'system', null, 'success', metadata: ['count' => $count]));

            return $count;
        });
        $total += $coordinator->each(TrustedSystemPurpose::RetentionCleanup, function (string $church) use ($audit): int {
            $value = DB::scalar('SELECT public.prune_church_operational_data(?,?,?,?)', [
                $church, now('UTC')->subDays((int) config('operations.security_retention_days')),
                now('UTC')->subDays((int) config('operations.sync_receipt_retention_days')),
                now('UTC')->subDays((int) config('operations.change_feed_retention_days')),
            ]);
            $count = array_sum(array_map('intval', json_decode($value, true, flags: JSON_THROW_ON_ERROR)));
            $count += app(RecoverySnapshotRetention::class)->pruneChurch($church);
            $audit->record(new AuditEntry('church', 'operations.retention.pruned', 'system', null, 'system', null, 'success', $church, metadata: ['count' => $count]));

            return $count;
        });
        $total += app(PurgeRejectedApplications::class)->handle();
        DB::transaction(function () use ($audit, $total): void {
            $audit->record(new AuditEntry('platform', 'operations.retention.pruned', 'system', null, 'system', null, 'success', metadata: ['count' => $total]));

        });
    }
}
