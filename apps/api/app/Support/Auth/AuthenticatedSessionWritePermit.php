<?php

namespace App\Support\Auth;

use App\Models\User;
use Illuminate\Http\Request;

/** Server-issued request-local permission, never accepted from request input. */
final readonly class AuthenticatedSessionWritePermit
{
    public const ATTRIBUTE = 'church.authenticated_session_write';

    private function __construct(
        public int $actorId,
        public string $sessionId,
        private string $identity,
        public array $claims,
        public bool $admission,
    ) {}

    public static function issue(Request $request, User $actor, bool $admission = false): void
    {
        $request->attributes->set(self::ATTRIBUTE, new self(
            (int) $actor->id, $request->session()->getId(), self::identity($actor),
            DatabaseSessionAuthority::securityClaims($request->session()->all()),
            $admission,
        ));
    }

    public function allows(string $sessionId, User $actor): bool
    {
        return $this->sessionId === $sessionId && $this->actorId === (int) $actor->id
            && hash_equals($this->identity, self::identity($actor));
    }

    public static function identity(User $actor): string
    {
        return hash_hmac('sha256', json_encode([
            $actor->id, $actor->email, $actor->getRawOriginal('email_verified_at'),
            $actor->password, $actor->two_factor_secret, $actor->getRawOriginal('two_factor_confirmed_at'),
            $actor->remember_token,
        ], JSON_THROW_ON_ERROR), (string) config('app.key'));
    }
}
