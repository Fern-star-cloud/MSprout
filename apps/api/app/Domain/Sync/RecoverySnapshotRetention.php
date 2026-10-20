<?php

namespace App\Domain\Sync;

use App\Domain\Audit\CorrelationContext;
use Illuminate\Support\Facades\DB;
use LogicException;

final class RecoverySnapshotRetention
{
    public function pruneChurch(string $church): int
    {
        $context = app(ChurchCoordination::class)->context();
        $role = DB::selectOne('SELECT current_user AS role,session_user AS authenticated');
        if ($context->churchId !== $church || $context->authorityKind !== 'system:retention_cleanup'
            || $role->role !== config('maintenance.role') || $role->authenticated !== $role->role) {
            throw new LogicException('Recovery cleanup requires the independent maintenance transaction.');
        }
        $count = 0;
        DB::select("SELECT set_config('app.correlation_id',?,true)", [app(CorrelationContext::class)->id()]);
        foreach (DB::table('offline_recovery_runs')->where('church_id', $church)->where('schema_version', RecoveryCodec::SCHEMA)
            ->whereRaw('expires_at<=clock_timestamp()')->whereNull('pages_purged_at')->orderBy('id')->get(['id']) as $run) {
            // The SQL function expires, compare-and-sets only this hold, purges
            // ciphertext and appends its mandatory audit in this transaction.
            $purged = (int) DB::scalar('SELECT public.cleanup_recovery_pages(?)', [$run->id]);
            $count += $purged;
        }

        return $count;
    }
}
