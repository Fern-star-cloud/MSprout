<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class ChurchSessionController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user('web');

        return response()->json([
            'id' => $user->getKey(),
            'email_verified' => $user->hasVerifiedEmail(),
            // Enrollment state only; operational Owner MFA is still checked by /api/me.
            'mfa_confirmed' => $user->hasEnabledTwoFactorAuthentication(),
            'workspaces' => $user->hasVerifiedEmail()
                ? DB::select('SELECT church_id, name, role FROM authenticated_church_workspaces(?)', [$user->getKey()])
                : [],
        ]);
    }
}
