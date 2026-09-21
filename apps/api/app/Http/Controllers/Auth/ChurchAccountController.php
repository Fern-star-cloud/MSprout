<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\ChurchMembership;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class ChurchAccountController extends Controller
{
    public function __invoke(Request $request, TenantContext $tenantContext): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'id' => $user->getKey(),
            'display_name' => $user->name,
            'email_verified' => $user->hasVerifiedEmail(),
            'memberships' => [[
                'church_id' => $tenantContext->churchId(),
                'role' => $tenantContext->role()->value,
                'status' => 'active',
            ]],
            'assignments' => [
                'ministry_ids' => DB::table('teacher_ministry_assignments')
                    ->where('church_id', $tenantContext->churchId())
                    ->where('membership_id', ChurchMembership::where('church_id', $tenantContext->churchId())->where('user_id', $user->id)->value('id'))
                    ->whereNull('revoked_at')
                    ->whereIn('ministry_id', DB::table('ministries')->select('id')->where('church_id', $tenantContext->churchId())->whereNull('archived_at'))
                    ->pluck('ministry_id')->all(),
            ],
            'active_session' => [
                'mfa_confirmed' => $user->hasEnabledTwoFactorAuthentication()
                    && $request->hasSession()
                    && $request->session()->get('church_mfa_user_id') === $user->getKey(),
            ],
        ]);
    }
}
