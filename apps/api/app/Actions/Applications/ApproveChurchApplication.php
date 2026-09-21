<?php

namespace App\Actions\Applications;

use App\Enums\ApplicationStatus;
use App\Models\Church;
use App\Models\ChurchApplication;
use App\Models\ChurchMembership;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ApproveChurchApplication
{
    public function handle(string $id, string $actorId, string $correlationId): ChurchApplication
    {
        return DB::transaction(function () use ($id, $actorId, $correlationId) {
            $application = ChurchApplication::query()->lockForUpdate()->findOrFail($id);
            if ($application->status === ApplicationStatus::Approved) {
                return $application;
            }
            abort_unless($application->status === ApplicationStatus::Pending, 409);
            $applicant = User::query()->lockForUpdate()->findOrFail($application->user_id);
            abort_unless($applicant->hasVerifiedEmail(), 403);
            $churchId = (string) Str::uuid();
            // A platform-authorized creation scope, not a borrowed membership. All RLS policies remain in force.
            $previous = DB::selectOne("SELECT current_setting('app.current_church_id', true) AS id")->id;
            DB::selectOne("SELECT set_config('app.current_church_id', ?, true)", [$churchId]);
            (new Church)->forceFill(['id' => $churchId, 'name' => $application->church_name, 'slug' => 'church-'.$churchId, 'timezone' => $application->timezone, 'status' => 'active'])->save();
            ChurchMembership::create(['church_id' => $churchId, 'user_id' => $application->user_id, 'role' => 'owner', 'status' => 'active']);
            // Validate deferred exactly-one-owner triggers while the new church scope is still active.
            DB::statement('SET CONSTRAINTS churches_exactly_one_active_owner, memberships_exactly_one_active_owner IMMEDIATE');
            DB::statement('SET CONSTRAINTS churches_exactly_one_active_owner, memberships_exactly_one_active_owner DEFERRED');
            DB::selectOne("SELECT set_config('app.current_church_id', ?, true)", [$previous ?? '']);
            $application->forceFill(['status' => ApplicationStatus::Approved, 'church_id' => $churchId, 'decided_by' => $actorId, 'decided_at' => now(), 'correlation_id' => $correlationId])->save();
            app(RecordApplicationDecision::class)->handle($application);

            return $application;
        });
    }
}
