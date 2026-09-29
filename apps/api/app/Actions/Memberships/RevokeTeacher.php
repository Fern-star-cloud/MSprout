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
            $manage->assign($teacher, [], $owner->user_id);
            app(RevokeMembershipAccess::class)->handle($id, $teacher->user_id, $owner->church_id);
            app(RecordMembershipAudit::class)->handle($owner->church_id, $owner->user_id, 'teacher.revoked', $id);
        });
    }
}
