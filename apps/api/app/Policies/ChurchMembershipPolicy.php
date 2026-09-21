<?php

namespace App\Policies;

use App\Models\ChurchMembership;
use App\Models\User;
use App\Support\Tenancy\TenantContext;

final class ChurchMembershipPolicy
{
    public function manage(User $user): bool
    {
        return ChurchMembership::query()->where('church_id', app(TenantContext::class)->churchId())
            ->where('user_id', $user->id)->where('role', 'owner')->where('status', 'active')->exists();
    }
}
