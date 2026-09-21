<?php

namespace App\Actions\Memberships;

use Illuminate\Support\Facades\DB;

final class RevokeTeacher
{
    public function handle(string $id): void
    {
        DB::transaction(function () use ($id) {
            $manage = app(ManageTeachers::class);
            $owner = $manage->owner();
            $teacher = $manage->teacher($id);
            $teacher->forceFill(['status' => 'revoked'])->save();
            DB::table('teacher_ministry_assignments')->where('church_id', $owner->church_id)->where('membership_id', $id)->whereNull('revoked_at')->update(['revoked_at' => now()]);
            app(RevokeMembershipAccess::class)->handle($id, $teacher->user_id, $owner->church_id);
            app(RecordMembershipAudit::class)->handle($owner->church_id, $owner->user_id, 'teacher.revoked', $id);
        });
    }
}
