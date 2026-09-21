<?php

namespace App\Actions\Applications;

use App\Enums\ApplicationStatus;
use App\Models\ChurchApplication;
use Illuminate\Support\Facades\DB;

final class RejectChurchApplication
{
    public function handle(string $id, string $actorId, string $correlationId, array $data): ChurchApplication
    {
        return DB::transaction(function () use ($id, $actorId, $correlationId, $data) {
            $application = ChurchApplication::query()->lockForUpdate()->findOrFail($id);
            if ($application->status === ApplicationStatus::Rejected) {
                return $application;
            }
            abort_unless($application->status === ApplicationStatus::Pending, 409);
            $application->forceFill(['status' => ApplicationStatus::Rejected, 'category' => $data['category'], 'reason' => $data['reason'], 'decided_by' => $actorId, 'decided_at' => now(), 'correlation_id' => $correlationId])->save();
            app(RecordApplicationDecision::class)->handle($application);

            return $application;
        });
    }
}
