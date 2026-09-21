<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\PlatformAdmin;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Contracts\TwoFactorAuthenticationProvider;
use Laravel\Fortify\Fortify;
use Laravel\Fortify\RecoveryCode;
use Symfony\Component\HttpFoundation\Response;

final class PlatformSessionController extends Controller
{
    public function setup(Request $request, PlatformAdmin $platformAdmin): JsonResponse
    {
        $data = $request->validate(['password' => ['required', 'string', 'min:12', 'max:128', 'confirmed']]);

        return DB::transaction(function () use ($request, $platformAdmin, $data) {
            $admin = PlatformAdmin::query()->lockForUpdate()->findOrFail($platformAdmin->id);
            abort_unless($admin->status === 'pending' && $admin->setup_expires_at?->isFuture() && $admin->password === null, 410);
            $provider = app(TwoFactorAuthenticationProvider::class);
            $secret = $provider->generateSecretKey();
            $codes = array_map(fn () => RecoveryCode::generate(), range(1, 8));
            $admin->forceFill([
                'password' => $data['password'], 'email_verified_at' => now(),
                'two_factor_secret' => Fortify::currentEncrypter()->encrypt($secret),
                'two_factor_recovery_codes' => Fortify::currentEncrypter()->encrypt(json_encode($codes)),
            ])->save();
            $request->session()->regenerate();
            $request->session()->put('platform.setup_id', $admin->id);

            return response()->json(['secret' => $secret, 'qr_code' => $provider->qrCodeUrl(config('app.name'), $admin->handle, $secret), 'recovery_codes' => $codes]);
        });
    }

    public function confirmSetup(Request $request, PlatformAdmin $platformAdmin): Response
    {
        $data = $request->validate(['code' => ['required', 'string'], 'recovery_codes_acknowledged' => ['required', 'accepted']]);
        DB::transaction(function () use ($request, $platformAdmin, $data) {
            $admin = PlatformAdmin::query()->lockForUpdate()->findOrFail($platformAdmin->id);
            abort_unless($request->session()->get('platform.setup_id') === $admin->id, 403);
            abort_unless($admin->status === 'pending' && $admin->setup_expires_at?->isFuture(), 410);
            $this->verifyCode($admin, $data);
            $admin->forceFill(['status' => 'active', 'two_factor_confirmed_at' => now(), 'recovery_codes_acknowledged_at' => now(), 'setup_expires_at' => null])->save();
            $this->authenticate($request, $admin);
        });

        return response()->noContent();
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate(['handle' => ['required', 'string', 'max:64'], 'password' => ['required', 'string', 'max:128']]);
        $admin = PlatformAdmin::query()->where('handle', strtolower($data['handle']))->first();
        if (! $admin || ! $this->active($admin) || ! Hash::check($data['password'], $admin->password)) {
            throw ValidationException::withMessages(['handle' => ['The supplied credentials are invalid.']]);
        }
        Auth::guard('platform')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        $request->session()->put('platform.challenge_id', $admin->id);
        $request->session()->put('platform.challenge_expires', now()->addMinutes(5)->timestamp);

        return response()->json(['two_factor' => true]);
    }

    public function challenge(Request $request): Response
    {
        $data = $request->validate(['code' => ['nullable', 'string', 'max:32'], 'recovery_code' => ['nullable', 'string', 'max:128']]);
        abort_unless($request->session()->get('platform.challenge_expires', 0) > now()->timestamp, 401);
        DB::transaction(function () use ($request, $data) {
            $admin = PlatformAdmin::query()->lockForUpdate()->find($request->session()->get('platform.challenge_id'));
            abort_unless($admin && $this->active($admin), 401);
            $this->verifyCode($admin, $data);
            $this->authenticate($request, $admin);
        });

        return response()->noContent();
    }

    private function verifyCode(PlatformAdmin $admin, array $data): void
    {
        $recovery = $data['recovery_code'] ?? null;
        if ($recovery && in_array($recovery, $admin->recoveryCodes(), true)) {
            $codes = array_values(array_diff($admin->recoveryCodes(), [$recovery]));
            $admin->forceFill(['two_factor_recovery_codes' => Fortify::currentEncrypter()->encrypt(json_encode($codes))])->save();

            return;
        }
        if (! $recovery && isset($data['code']) && app(TwoFactorAuthenticationProvider::class)->verify(Fortify::currentEncrypter()->decrypt($admin->two_factor_secret), $data['code'])) {
            return;
        }
        throw ValidationException::withMessages(['code' => ['The authentication code is invalid.']]);
    }

    private function active(PlatformAdmin $admin): bool
    {
        return $admin->status === 'active' && $admin->email_verified_at && $admin->hasEnabledTwoFactorAuthentication() && $admin->recovery_codes_acknowledged_at;
    }

    private function authenticate(Request $request, PlatformAdmin $admin): void
    {
        $request->session()->forget(['platform.setup_id', 'platform.challenge_id', 'platform.challenge_expires']);
        Auth::guard('platform')->login($admin);
        $request->session()->regenerate();
        $request->session()->put('platform.mfa', true);
        $admin->forceFill(['last_authenticated_at' => now()])->save();
    }

    public function logout(Request $request): Response
    {
        Auth::guard('platform')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent();
    }

    public function setupStatus(PlatformAdmin $platformAdmin): JsonResponse
    {
        abort_unless(
            $platformAdmin->status === 'pending'
                && $platformAdmin->setup_expires_at?->isFuture(),
            410,
        );

        return response()->json([
            'handle' => $platformAdmin->handle,
            'status' => 'pending',
            'expires_at' => $platformAdmin->setup_expires_at->toISOString(),
        ]);
    }

    public function csrfToken(Request $request): JsonResponse
    {
        return response()->json(['csrf_token' => $request->session()->token()]);
    }

    public function show(Request $request): JsonResponse
    {
        abort_unless($this->active($request->user('platform')) && $request->session()->get('platform.mfa') === true, 403);

        return response()->json([
            'handle' => $request->user('platform')->handle,
            'online_only' => true,
        ]);
    }
}
