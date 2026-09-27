<?php

namespace App\Policies;

use App\Enums\ChurchRole;
use App\Models\ChurchMembership;
use App\Models\Student;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;

final class StudentPolicy
{
    public function manage(User $user): bool
    {
        return (new ChurchMembershipPolicy)->manage($user);
    }

    public function view(User $user, Student $student): bool
    {
        $tenant = app(TenantContext::class);
        if ($student->church_id !== $tenant->churchId()) {
            return false;
        }
        if ($tenant->role() === ChurchRole::Owner) {
            return true;
        }
        $membership = ChurchMembership::where('church_id', $tenant->churchId())->where('user_id', $user->id)->where('status', 'active')->first();

        return $membership !== null && DB::table('enrollments')->join('teacher_ministry_assignments', function ($join) {
            $join->on('teacher_ministry_assignments.church_id', '=', 'enrollments.church_id')
                ->on('teacher_ministry_assignments.ministry_id', '=', 'enrollments.ministry_id');
        })->join('ministries', function ($join) {
            $join->on('ministries.church_id', '=', 'enrollments.church_id')->on('ministries.id', '=', 'enrollments.ministry_id');
        })->whereNull('ministries.deleted_at')->whereNull('ministries.archived_at')
            ->where('enrollments.church_id', $tenant->churchId())->where('enrollments.student_id', $student->id)
            ->whereNull('enrollments.deleted_at')->where('teacher_ministry_assignments.membership_id', $membership->id)
            ->whereNull('teacher_ministry_assignments.revoked_at')->exists();
    }
}
