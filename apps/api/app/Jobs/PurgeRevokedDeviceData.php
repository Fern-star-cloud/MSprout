<?php

namespace App\Jobs;

use App\Domain\Audit\AuditEntry;
use App\Domain\Audit\AuditWriter;
use App\Domain\Sync\MaintenanceCoordinator;
use App\Domain\Sync\TrustedSystemPurpose;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;

final class PurgeRevokedDeviceData implements ShouldQueue
{
    use Queueable;

    public function handle(AuditWriter $audit): void
    {
        $total = app(MaintenanceCoordinator::class)->each(TrustedSystemPurpose::RevokedDeviceCleanup, function (string $church) use ($audit): int {
            $value = DB::scalar('SELECT public.purge_church_revoked_device_data(?, ?, ?)', [
                $church,
                now('UTC')->subDays((int) config('operations.revoked_device_secret_retention_days')),
                now('UTC')->subDays((int) config('operations.offline_authorization_retention_days')),
            ]);
            $counts = is_string($value) ? json_decode($value, true, flags: JSON_THROW_ON_ERROR) : $value;
            $count = array_sum(array_map('intval', $counts));
            $audit->record(new AuditEntry('church', 'operations.devices.purged', 'system', null, 'system', null, 'success', $church, metadata: ['count' => $count]));

            return $count;
        });
        DB::transaction(function () use ($audit, $total): void {
            $audit->record(new AuditEntry(
                'platform', 'operations.devices.purged', 'system', null, 'system', null, 'success',
                metadata: ['count' => $total],
            ));
        });
    }
}
