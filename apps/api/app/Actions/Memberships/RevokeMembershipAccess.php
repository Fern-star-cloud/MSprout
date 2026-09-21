<?php

namespace App\Actions\Memberships;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class RevokeMembershipAccess
{
    public function handle(string $membershipId, int $userId, string $churchId): void
    {
        foreach (['offline_authorizations', 'push_subscriptions'] as $table) {
            DB::table($table)->where('church_id', $churchId)->where('membership_id', $membershipId)->whereNull('revoked_at')->update(['revoked_at' => now()]);
        }
        DB::table('sessions')->where('user_id', $userId)->delete();
        User::whereKey($userId)->update(['remember_token' => Str::random(60)]);
    }
}
