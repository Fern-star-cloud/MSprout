<?php

namespace App\Jobs;

use App\Enums\ApplicationStatus;
use App\Models\ChurchApplication;
use App\Models\User;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;

class PurgeRejectedApplications implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        ChurchApplication::query()->where('status', 'rejected')->whereNull('purged_at')->where('decided_at', '<=', now()->subDays(30))
            ->select('id')->chunkById(100, function ($applications) {
                foreach ($applications as $candidate) {
                    DB::transaction(function () use ($candidate) {
                        $application = ChurchApplication::query()->lockForUpdate()->findOrFail($candidate->id);
                        if ($application->purged_at || $application->status !== ApplicationStatus::Rejected || $application->decided_at->gt(now()->subDays(30))) {
                            return;
                        }
                        $user = User::query()->lockForUpdate()->find($application->user_id);
                        $application->forceFill([
                            'church_name' => null, 'city' => null, 'address' => null, 'timezone' => null,
                            'duplicate_key' => null, 'reason' => null, 'purged_at' => now(),
                        ])->save();
                        if (! $user || ChurchApplication::query()->where('user_id', $user->id)->whereNull('purged_at')->exists()) {
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
    }
}
