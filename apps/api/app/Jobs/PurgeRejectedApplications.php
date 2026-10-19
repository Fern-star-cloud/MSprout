<?php

namespace App\Jobs;

use App\Domain\Audit\AuditEntry;
use App\Domain\Audit\AuditWriter;
use App\Domain\Sync\MaintenanceCoordinator;
use App\Enums\ApplicationStatus;
use App\Models\ChurchApplication;
use App\Support\Auth\UserAuthorityLocks;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;

class PurgeRejectedApplications implements ShouldQueue
{
    use Queueable;

    public function handle(): int
    {
        app(MaintenanceCoordinator::class)->assertWorker();
        $purged = 0;
        ChurchApplication::query()->where('status', 'rejected')->whereNull('purged_at')->where('decided_at', '<=', now()->subDays(30))
            ->select(['id', 'user_id'])->chunkById(100, function ($applications) use (&$purged) {
                foreach ($applications as $candidate) {
                    app(UserAuthorityLocks::class)->run([(int) $candidate->user_id => 'write'], function ($actors) use ($candidate, &$purged) {
                        $application = ChurchApplication::query()->lockForUpdate()->findOrFail($candidate->id);
                        if ((int) $application->user_id !== (int) $candidate->user_id) {
                            throw new \LogicException('Application identity changed during cleanup.');
                        }
                        if ($application->purged_at || $application->status !== ApplicationStatus::Rejected || $application->decided_at->gt(now()->subDays(30))) {
                            return;
                        }
                        $user = $actors[$candidate->user_id] ?? null;
                        $application->forceFill([
                            'church_name' => null, 'city' => null, 'address' => null, 'timezone' => null,
                            'duplicate_key' => null, 'reason' => null, 'purged_at' => now(),
                        ])->save();
                        $purged++;
                        app(AuditWriter::class)->record(new AuditEntry('platform', 'application.retention.purged', 'system', null, 'application', $application->id, 'success', metadata: ['count' => 1]));
                        if (! $user || ChurchApplication::query()->where('user_id', $user->id)->whereNull('purged_at')->exists()
                            || DB::scalar('SELECT public.protected_user_has_memberships(?)', [$user->id])) {
                            return;
                        }
                        try {
                            DB::transaction(function () use ($user) {
                                // RESTRICT checks all memberships at the database level, including rows hidden by RLS.
                                $user->delete();
                                DB::table('sessions')->where('user_id', $user->id)->delete();
                                DB::table('password_reset_tokens')->where('email', $user->email)->delete();
                            });
                        } catch (QueryException $exception) {
                            if (! in_array($exception->errorInfo[0] ?? null, ['23503', '23001'], true)) {
                                throw $exception;
                            }
                        }
                    });
                }
            });

        return $purged;
    }
}
