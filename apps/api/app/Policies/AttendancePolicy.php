<?php

namespace App\Policies;

use App\Enums\AttendanceSessionStatus;
use App\Enums\ChurchRole;
use App\Models\AttendanceSession;
use App\Models\ChurchMembership;
use App\Models\Ministry;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;

final class AttendancePolicy
{
    public function view(User $user, AttendanceSession $session): bool
    {
        return $session->church_id === app(TenantContext::class)->churchId()
            && $this->canAccessMinistry($user, $session->ministry_id);
    }

    public function create(User $user, string $ministryId): bool
    {
        $churchId = app(TenantContext::class)->churchId();

        return Ministry::query()
            ->where('church_id', $churchId)
            ->whereKey($ministryId)
            ->whereNull('archived_at')
            ->whereNull('deleted_at')
            ->exists()
            && $this->canAccessMinistry($user, $ministryId);
    }

    public function update(User $user, AttendanceSession $session): bool
    {
        return $session->status === AttendanceSessionStatus::Draft && $this->view($user, $session);
    }

    public function finalize(User $user, AttendanceSession $session): bool
    {
        return $this->update($user, $session);
    }

    private function canAccessMinistry(User $user, string $ministryId): bool
    {
        $tenant = app(TenantContext::class);
        $membership = ChurchMembership::query()
            ->where('church_id', $tenant->churchId())
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->first();
        if ($membership === null) {
            return false;
        }
        if ($membership->role === ChurchRole::Owner) {
            return true;
        }

        return DB::table('teacher_ministry_assignments')
            ->join('ministries', function ($join): void {
                $join->on('ministries.church_id', '=', 'teacher_ministry_assignments.church_id')
                    ->on('ministries.id', '=', 'teacher_ministry_assignments.ministry_id');
            })
            ->where('teacher_ministry_assignments.church_id', $tenant->churchId())
            ->where('teacher_ministry_assignments.membership_id', $membership->id)
            ->where('teacher_ministry_assignments.ministry_id', $ministryId)
            ->whereNull('teacher_ministry_assignments.revoked_at')
            ->whereNull('ministries.archived_at')
            ->whereNull('ministries.deleted_at')
            ->exists();
    }
}
