<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Support\Auth\AuthenticatedSessionWritePermit;
use App\Support\Auth\DatabaseSessionAuthority;
use App\Support\Auth\UserAuthorityLocks;
use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Global authentication paths never acquire an existing-church gate. */
final class FenceChurchAuthentication
{
    public function handle(Request $request, Closure $next)
    {
        if (! $request->is('login', 'logout', 'two-factor-challenge', 'reset-password', 'user/*', 'email/*', 'auth/session', 'api/me')) {
            return $next($request);
        }
        $guard = Auth::guard('web');
        $previous = $guard->user();
        $id = $previous?->id;
        $challenge = $request->is('two-factor-challenge');
        if ($id === null && $challenge) {
            $id = $request->session()->get('login.id');
        }
        if ($id === null && $request->is('login', 'reset-password') && is_string($request->input('email'))) {
            $id = User::where('email', mb_strtolower($request->input('email')))->value('id');
        }
        if ($id === null) {
            return $next($request);
        }

        return app(UserAuthorityLocks::class)->run([(int) $id => $request->is('auth/session', 'api/me') ? 'read' : 'write'], function ($actors) use ($id, $previous, $guard, $challenge, $request, $next) {
            $actor = $actors[$id] ?? null;
            if ($actor === null) {
                throw new AuthenticationException;
            }
            if ($previous !== null || $challenge) {
                app(DatabaseSessionAuthority::class)->validate($request, $actor, $challenge);
            }
            if ($challenge && ! hash_equals(
                AuthenticatedSessionWritePermit::identity($actor), (string) $request->session()->get('church.login_proof'),
            )) {
                throw new AuthenticationException;
            }
            if ($previous !== null) {
                $guard->setUser($actor);
                $request->setUserResolver(fn ($name = null) => Auth::guard($name ?? 'web')->user());
            }
            $mfaBefore = [$actor->two_factor_secret, $actor->getRawOriginal('two_factor_confirmed_at')];
            $passwordBefore = $actor->password;
            $response = $next($request);
            if ($response->getStatusCode() >= 400) {
                return $response;
            }
            $fresh = User::findOrFail($actor->id);
            if ($fresh->password !== $passwordBefore) {
                // Preserve only the explicitly authenticated password-change session.
                // Reset flows have no such session and revoke every old session.
                $sessions = DB::table(config('session.table'))->where('user_id', $actor->id);
                if ($request->is('user/password') && $previous !== null) {
                    $sessions->where('id', '<>', $request->session()->getId());
                }
                $sessions->delete();
                $fresh->setRememberToken(Str::random(60));
                $fresh->save();
            }
            if ($mfaBefore !== [$fresh->two_factor_secret, $fresh->getRawOriginal('two_factor_confirmed_at')]) {
                // All writers use User-before-session order. Never copy old MFA proof back.
                $rows = DB::table(config('session.table'))->where('user_id', $actor->id)->orderBy('id')->lockForUpdate()->get();
                foreach ($rows as $row) {
                    $claims = DatabaseSessionAuthority::decode(base64_decode($row->payload));
                    Arr::forget($claims, ['church_mfa_user_id', 'church.login_proof']);
                    DB::table(config('session.table'))->where('id', $row->id)->update(['payload' => base64_encode(DatabaseSessionAuthority::encode($claims))]);
                }
                if (! $request->is('user/confirmed-two-factor-authentication')) {
                    $request->session()->forget('church_mfa_user_id');
                }
            }
            if ($request->is('login') && (string) $request->session()->get('login.id') === (string) $fresh->id) {
                $request->session()->put('church.login_proof', AuthenticatedSessionWritePermit::identity($fresh));
            }
            if ((string) $guard->id() === (string) $fresh->id) {
                $request->session()->put('password_hash_web', $fresh->password);
                $guard->setUser($fresh);
                AuthenticatedSessionWritePermit::issue($request, $fresh, $request->is('login', 'two-factor-challenge'));
            }

            return $response;
        });
    }
}
