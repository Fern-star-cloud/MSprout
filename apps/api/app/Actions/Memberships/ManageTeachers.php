<?php

namespace App\Actions\Memberships;

use App\Models\Church;
use App\Models\ChurchMembership;
use App\Models\TeacherMinistryAssignment;
use App\Policies\ChurchMembershipPolicy;
use App\Support\Tenancy\TenantContext;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

final class ManageTeachers
{
    public function owner(): ChurchMembership
    {
        $churchId = app(TenantContext::class)->churchId();
        abort_unless(Church::query()->whereKey($churchId)->where('status', 'active')->lockForUpdate()->first(), 403);
        abort_unless((new ChurchMembershipPolicy)->manage(Auth::user()), 403);

        return ChurchMembership::query()->where('church_id', $churchId)->where('user_id', Auth::id())->lockForUpdate()->firstOrFail();
    }

    public function teacher(string $id): ChurchMembership
    {
        return ChurchMembership::query()->where('church_id', app(TenantContext::class)->churchId())
            ->where('role', 'teacher')->where('status', 'active')->lockForUpdate()->findOrFail($id);
    }

    public function validateMinistries(array $ids, string $churchId): void
    {
        abort_unless(DB::table('ministries')->where('church_id', $churchId)->whereNull('archived_at')->whereIn('id', $ids)->count() === count($ids), 422);
    }

    public function assign(ChurchMembership $membership, array $ids, int $actorId): void
    {
        $this->validateMinistries($ids, $membership->church_id);
        TeacherMinistryAssignment::query()->where('church_id', $membership->church_id)->where('membership_id', $membership->id)
            ->whereNull('revoked_at')->whereNotIn('ministry_id', $ids)->update(['revoked_at' => now()]);
        foreach ($ids as $id) {
            TeacherMinistryAssignment::updateOrCreate(
                ['church_id' => $membership->church_id, 'membership_id' => $membership->id, 'ministry_id' => $id],
                ['assigned_by' => $actorId, 'revoked_at' => null],
            );
        }
    }
}
