<?php

namespace App\Jobs;

use App\Domain\Audit\AuditEntry;
use App\Domain\Audit\AuditWriter;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;

final class PurgeRevokedDeviceData implements ShouldQueue
{
    use Queueable;

    public function handle(AuditWriter $audit): void
    {
        DB::transaction(function () use ($audit): void {
            $value = DB::scalar('SELECT purge_revoked_device_data(?, ?)', [
                now('UTC')->subDays((int) config('operations.revoked_device_secret_retention_days')),
                now('UTC')->subDays((int) config('operations.offline_authorization_retention_days')),
            ]);
            $counts = is_string($value) ? json_decode($value, true, flags: JSON_THROW_ON_ERROR) : $value;
            $audit->record(new AuditEntry(
                'platform', 'operations.devices.purged', 'system', null, 'system', null, 'success',
                metadata: ['count' => array_sum(array_map('intval', is_array($counts) ? $counts : []))],
            ));
        });
    }
}
