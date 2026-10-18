<?php

namespace App\Support\Auth;

use App\Models\User;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Auth\Recaller;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use LogicException;

final class DatabaseSessionAuthority
{
    public static function securityKeys(): array
    {
        return [Auth::guard('web')->getName(), 'church_mfa_user_id', 'auth.password_confirmed_at',
            'password_hash_web', 'login.id', 'login.remember', 'church.login_proof'];
    }

    public static function securityClaims(array $data): array
    {
        $claims = [];
        foreach (self::securityKeys() as $key) {
            if (Arr::has($data, $key)) {
                Arr::set($claims, $key, Arr::get($data, $key));
            }
        }

        return $claims;
    }

    public static function decode(string $data): array
    {
        if (config('session.serialization') !== 'json') {
            throw new LogicException('Church authority requires the configured JSON session serializer.');
        }
        if (config('session.encrypt')) {
            $data = app('encrypter')->decrypt($data);
        }
        $decoded = json_decode($data, true, 512, JSON_THROW_ON_ERROR);
        if (! is_array($decoded)) {
            throw new AuthenticationException;
        }

        return $decoded;
    }

    public static function encode(array $data): string
    {
        $encoded = json_encode($data, JSON_THROW_ON_ERROR);

        return config('session.encrypt') ? app('encrypter')->encrypt($encoded) : $encoded;
    }

    public function validate(Request $request, User $actor, bool $challenge = false): array
    {
        if (! $request->hasSession() || ! $request->session()->getHandler() instanceof GuardAwareDatabaseSessionHandler
            || DB::transactionLevel() < 1) {
            throw new AuthenticationException;
        }
        $sessionConnection = DB::connection(config('session.connection'));
        if ($sessionConnection->getPdo() !== DB::connection()->getPdo()) {
            throw new LogicException('Session authority must share the primary transaction.');
        }
        $row = $sessionConnection->table(config('session.table'))->where('id', $request->session()->getId())->sharedLock()->first();
        if ($row === null && ! $challenge && Auth::guard('web')->viaRemember()) {
            $guard = Auth::guard('web');
            $cookie = $request->cookie($guard->getRecallerName());
            $recaller = is_string($cookie) ? new Recaller($cookie) : null;
            if ($recaller === null || ! $recaller->valid() || (string) $recaller->id() !== (string) $actor->id
                || ! is_string($actor->remember_token) || ! hash_equals($actor->remember_token, $recaller->token())
                || ! hash_equals($guard->hashPasswordForCookie($actor->password), $recaller->hash())) {
                throw new AuthenticationException;
            }
            $request->session()->forget(['church_mfa_user_id', 'auth.password_confirmed_at', 'church.login_proof']);
            AuthenticatedSessionWritePermit::issue($request, $actor, true);
            $request->session()->save();
            $row = $sessionConnection->table(config('session.table'))->where('id', $request->session()->getId())->sharedLock()->first();
        }
        if ($row === null || $row->last_activity < now()->subMinutes((int) config('session.lifetime'))->timestamp) {
            throw new AuthenticationException;
        }
        $raw = base64_decode($row->payload, true);
        if ($raw === false) {
            throw new AuthenticationException;
        }
        $claims = self::decode($raw);
        $principal = Arr::get($claims, $challenge ? 'login.id' : Auth::guard('web')->getName());
        if ((string) $principal !== (string) $actor->id || (! $challenge && (string) $row->user_id !== (string) $actor->id)) {
            throw new AuthenticationException;
        }
        // Stateful middleware may have read the old password before the church wait.
        // Recheck both the persisted proof and that already-loaded request proof.
        foreach ([$claims['password_hash_web'] ?? null, $request->session()->get('password_hash_web')] as $passwordProof) {
            if ($passwordProof !== null && (! is_string($passwordProof)
                || (! hash_equals(Auth::guard('web')->hashPasswordForCookie($actor->password), $passwordProof)
                    && ! hash_equals($actor->password, $passwordProof)))) {
                throw new AuthenticationException;
            }
        }
        foreach (self::securityKeys() as $key) {
            $request->session()->forget($key);
            if (Arr::has($claims, $key)) {
                $request->session()->put($key, Arr::get($claims, $key));
            }
        }

        return $claims;
    }
}
