<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
                'ministry_ids' => [],
            ],
            'active_session' => [
                'mfa_confirmed' => $user->hasEnabledTwoFactorAuthentication()
                    && $request->hasSession()
                    && $request->session()->get('church_mfa_user_id') === $user->getKey(),
            ],
        ]);
    }
}
