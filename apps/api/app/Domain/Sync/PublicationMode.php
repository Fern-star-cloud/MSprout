<?php

namespace App\Domain\Sync;

use App\Domain\Attendance\AttendanceCompatibilityException;
use Illuminate\Support\Facades\DB;
use LogicException;

final class PublicationMode
{
    public function requireDeviceRecovery(): void
    {
        if ($this->coordinated()) {
            // Publication qualification is not a reconstructed client baseline.
            // Later approved snapshot/client work must replace this non-settling fence.
            throw new AttendanceCompatibilityException('full_bootstrap_required');
        }
    }

    public function coordinated(): bool
    {
        if (config('synchronization.coordinated_publication') !== true) {
            return false;
        }
        if (DB::scalar("SELECT to_regclass('public.sync_publication_control')") === null
            || DB::table('sync_publication_control')->where('singleton', true)->value('active') !== true) {
            throw new LogicException('Coordinated publication requires qualified database activation.');
        }

        return true;
    }
}
