<?php

namespace App\Domain\Sync;

use App\Models\ChurchMembership;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class SyncAuthorization
{
    public function membership(Request $request, string $deviceId): ChurchMembership
    {
        $churchId = app(TenantContext::class)->churchId();
        $membership = ChurchMembership::query()
            ->where('church_id', $churchId)
            ->where('user_id', $request->user()->id)
            ->where('status', 'active')
            ->firstOrFail();

        abort_unless(DB::table('offline_authorizations')
            ->where('church_id', $churchId)
            ->where('membership_id', $membership->id)
            ->where('device_id', $deviceId)
            ->whereNull('revoked_at')
            ->where('expires_at', '>', now('UTC'))
            ->exists(), 403);

        return $membership;
    }
}
