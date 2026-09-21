<?php

namespace App\Actions\Memberships;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Laravel\Fortify\Contracts\TwoFactorAuthenticationProvider;
use Laravel\Fortify\Fortify;

final class TransferOwnership
{
    public function handle(string $targetId, string $password, string $code): void
    {
        DB::transaction(function () use ($targetId, $password, $code) {
            $manage = app(ManageTeachers::class);
            // All membership mutations serialize on the church row, then recheck the actual owner.
            $owner = $manage->owner();
            $target = $manage->teacher($targetId);
            $user = User::query()->lockForUpdate()->findOrFail($owner->user_id);
            abort_unless(Hash::check($password, $user->password) && $user->hasEnabledTwoFactorAuthentication(), 422);
            abort_unless(app(TwoFactorAuthenticationProvider::class)->verify(Fortify::currentEncrypter()->decrypt($user->two_factor_secret), $code), 422);
            $owner->forceFill(['role' => 'teacher'])->save();
            $target->forceFill(['role' => 'owner'])->save();
            foreach ([$owner, $target] as $membership) {
                app(RevokeMembershipAccess::class)->handle($membership->id, $membership->user_id, $membership->church_id);
            }
            app(RecordMembershipAudit::class)->handle($owner->church_id, $owner->user_id, 'ownership.transferred', $target->id, $owner->id);
            DB::statement('SET CONSTRAINTS churches_exactly_one_active_owner, memberships_exactly_one_active_owner IMMEDIATE');
            DB::statement('SET CONSTRAINTS churches_exactly_one_active_owner, memberships_exactly_one_active_owner DEFERRED');
        });
    }
}
