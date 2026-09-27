<?php

namespace App\Http\Middleware;

use App\Domain\Audit\AuditEntry;
use App\Domain\Audit\AuditWriter;
use App\Domain\Audit\RecordDeniedAttempt;
use App\Domain\Audit\SecurityEventWriter;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\DB;
use Throwable;

final class AuditAuthentication
{
    public function handle(Request $request, Closure $next)
    {
        $action = $this->action($request);
        if ($action === null) {
            return $next($request);
        }
        $platform = $request->is('platform/*');
        $guard = Auth::guard($platform ? 'platform' : 'web');
        $previousUser = $guard->user();
        $session = $request->session()->all();
        $actor = $previousUser?->getAuthIdentifier()
            ?? $request->session()->get($platform ? 'platform.challenge_id' : 'login.id')
            ?? $request->session()->get('platform.setup_id');
        $level = DB::transactionLevel();
        DB::beginTransaction();
        try {
            $response = $next($request);
            if ($response->getStatusCode() >= 400) {
                DB::rollBack($level);
                $this->restore($request, $guard, $previousUser, $session);
                $recorded = app(RecordDeniedAttempt::class)->record($action, 'failure', $actor === null ? 'anonymous' : ($platform ? 'platform_admin' : 'user'), $actor === null ? null : (string) $actor);
                if ($recorded) {
                    $request->attributes->set('audit.security_event_recorded', true);
                }

                return $response;
            }
            $actor ??= $guard->id() ?? $request->attributes->get('audit.auth_actor')
                ?? $request->session()->get($platform ? 'platform.challenge_id' : 'login.id')
                ?? $request->session()->get('platform.setup_id');
            $type = $actor === null ? 'anonymous' : ($platform ? 'platform_admin' : 'user');
            $actor = $actor === null ? null : (string) $actor;
            if ($action === 'mfa.challenge' && $request->filled('recovery_code')) {
                $action = 'mfa.recovered';
            }
            app(SecurityEventWriter::class)->record($action, 'success', $type, $actor);
            if ($platform) {
                app(AuditWriter::class)->record(new AuditEntry('platform', 'platform.'.$action, $type, $actor, 'platform_admin', $actor));
            }
            DB::commit();

            return $response;
        } catch (Throwable $exception) {
            DB::rollBack($level);
            $this->restore($request, $guard, $previousUser, $session);
            throw $exception;
        }
    }

    private function restore(Request $request, $guard, $user, array $session): void
    {
        $request->session()->replace($session);
        $guard->forgetUser();
        if ($user !== null) {
            $guard->setUser($user->fresh());
        }
        foreach (Cookie::getQueuedCookies() as $cookie) {
            Cookie::unqueue($cookie->getName(), $cookie->getPath());
        }
    }

    private function action(Request $request): ?string
    {
        $path = $request->path();
        if ($request->isMethod('GET')) {
            return match ($path) {
                'user/two-factor-recovery-codes', 'user/two-factor-secret-key', 'user/two-factor-qr-code' => 'mfa.material_viewed',
                default => null,
            };
        }
        if ($request->is('platform/setup/*')) {
            return str_ends_with($path, '/confirm') ? 'mfa.confirmed' : 'mfa.enrolled';
        }

        return match ($path) {
            'login', 'platform/login' => 'auth.login',
            'logout', 'platform/logout' => 'auth.logout',
            'two-factor-challenge', 'platform/two-factor-challenge' => 'mfa.challenge',
            'user/two-factor-authentication' => $request->isMethod('DELETE') ? 'mfa.disabled' : 'mfa.enrolled',
            'user/confirmed-two-factor-authentication' => 'mfa.confirmed',
            'user/two-factor-recovery-codes' => 'mfa.recovery_regenerated',
            'forgot-password' => 'password.reset_requested',
            'reset-password' => 'password.reset',
            'user/password' => 'password.changed',
            'user/confirm-password' => 'password.confirmed',
            'user/profile-information' => 'account.updated',
            'email/verification-notification' => 'account.verification_requested',
            default => null,
        };
    }
}
