<?php

namespace App\Domain\Sync;

use App\Actions\Invitations\VerifiedInvitationAuthority;
use App\Enums\ChurchRole;
use App\Models\Church;
use App\Models\ChurchMembership;
use App\Support\Auth\DatabaseSessionAuthority;
use App\Support\Auth\UserAuthorityLocks;
use App\Support\Tenancy\TenantContext;
use Closure;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use LogicException;

/** Authority integration only. The SQL publisher remains dormant. */
final class ChurchCoordination
{
    private ?CoordinatedChurchTransaction $active = null;

    public function __construct(private readonly TenantContext $tenant) {}

    public function run(Request $request, Closure $operation, ?string $ministryId = null): mixed
    {
        $churchId = $this->tenant->churchId();
        $church = $this->gate('member');
        $actorId = $request->user()?->getKey();
        if ($actorId === null) {
            throw new AuthorizationException;
        }

        return app(UserAuthorityLocks::class)->run(MemberCoordinationIntent::participants($request, $churchId, (int) $actorId), function ($actors) use ($request, $operation, $ministryId, $churchId, $church, $actorId): mixed {
            $actor = $actors[$actorId] ?? null;
            $member = ChurchMembership::query()->where('church_id', $churchId)
                ->where('user_id', $actorId)->where('status', 'active')->first();
            if ($church?->status !== 'active' || $actor === null || (string) Auth::id() !== (string) $actorId || ! $actor->hasVerifiedEmail()
                || $member === null || $member->role !== $this->tenant->role()) {
                throw new AuthorizationException;
            }
            app(DatabaseSessionAuthority::class)->validate($request, $actor);
            Auth::guard('web')->setUser($actor);
            $request->setUserResolver(fn ($guard = null) => Auth::guard($guard ?? 'web')->user());
            if ($member->role === ChurchRole::Owner && (! $actor->hasEnabledTwoFactorAuthentication()
                || $request->session()->get('church_mfa_user_id') !== $actor->getKey())) {
                throw new AuthorizationException;
            }
            if ($ministryId !== null) {
                $ministry = DB::table('ministries')->where('church_id', $churchId)->where('id', $ministryId)
                    ->whereNull('archived_at')->whereNull('deleted_at')->exists();
                $assigned = $member->role === ChurchRole::Owner || DB::table('teacher_ministry_assignments')
                    ->where('church_id', $churchId)->where('membership_id', $member->id)
                    ->where('ministry_id', $ministryId)->whereNull('revoked_at')->exists();
                if (! $ministry || ! $assigned) {
                    throw new AuthorizationException;
                }
            }

            return $this->invoke('member', fn ($context) => $operation($member, $actor, $context));
        });
    }

    public function runInvitation(Request $request, VerifiedInvitationAuthority $authority, Closure $operation): mixed
    {
        if ($authority->churchId() !== $this->tenant->churchId()) {
            throw new LogicException('Invitation authority scope mismatch.');
        }
        abort_unless($this->gate('invitation')?->status === 'active', 410);
        $invitation = $authority->current();
        $actorId = Auth::guard('web')->id();
        $participants = [(int) $invitation->inviter_id => 'read'];
        if ($actorId !== null) {
            $participants[(int) $actorId] = 'read';
        }

        return app(UserAuthorityLocks::class)->run($participants, function ($actors) use ($request, $authority, $operation, $actorId): mixed {
            // Unusable proof retains 410 precedence after every authority wait.
            $authority->current();
            $actor = $actorId === null ? null : ($actors[$actorId] ?? null);
            if ($actorId !== null) {
                abort_unless($actor && $actor->hasVerifiedEmail()
                    && hash_equals(Str::lower(trim($actor->email)), $authority->email()), 403);
                app(DatabaseSessionAuthority::class)->validate($request, $actor);
                Auth::guard('web')->setUser($actor);
            }
            $invitation = $authority->current(true);

            return $this->invoke('invitation', fn ($context) => $operation($invitation, $actor, $context));
        });
    }

    public function runSystem(TrustedSystemPurpose $purpose, Closure $operation): mixed
    {
        $this->tenant->assertSystemPurpose($purpose);
        $kind = 'system:'.$purpose->value;
        $church = $this->gate($kind);
        if ($church === null || ! $purpose->allowsStatus($church->status)) {
            throw new AuthorizationException;
        }

        return $this->invoke($kind, $operation);
    }

    private function gate(string $kind): ?Church
    {
        if ($this->active !== null) {
            $this->assertContext($this->active);
            if ($this->active->authorityKind !== $kind) {
                throw new LogicException('Different authority kinds cannot be nested.');
            }
        } else {
            if (DB::transactionLevel() !== 1) {
                throw new LogicException('Acquire the primary church gate in the outer tenant transaction.');
            }
            if (DB::scalar('SHOW transaction_isolation') !== 'read committed') {
                throw new LogicException('Fresh post-wait authority requires read committed isolation.');
            }
            $late = DB::scalar(<<<'SQL'
                SELECT EXISTS (
                    SELECT 1 FROM pg_catalog.pg_locks l
                    LEFT JOIN pg_catalog.pg_class c ON c.oid=l.relation
                    LEFT JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
                    WHERE l.pid=pg_backend_pid() AND l.granted AND (
                        l.locktype='advisory' OR (n.nspname='public' AND c.relkind IN ('r','p') AND (
                            l.mode IN ('RowExclusiveLock','ShareRowExclusiveLock','ExclusiveLock','AccessExclusiveLock')
                            OR (l.mode='RowShareLock' AND c.relname<>'churches')
                        ))
                    )
                )
                SQL);
            if ($late) {
                throw new LogicException('Church coordination must precede domain and advisory locks.');
            }
        }

        return Church::whereKey($this->tenant->churchId())->lock('FOR NO KEY UPDATE')->first();
    }

    private function invoke(string $kind, Closure $operation): mixed
    {
        if ($this->active !== null) {
            return $operation($this->active);
        }
        $identity = DB::selectOne('SELECT pg_backend_pid() AS pid, pg_current_xact_id()::text AS xid');
        $context = new CoordinatedChurchTransaction($this, DB::connection()->getPdo(), $this->tenant->churchId(), (int) $identity->pid, $identity->xid, $kind);
        $this->active = $context;
        try {
            return $operation($context);
        } finally {
            $this->active = null;
        }
    }

    public function assertMemberAuthority(): void
    {
        if ($this->active === null || $this->active->authorityKind !== 'member') {
            throw new LogicException('No coordinated member authority.');
        }
        $this->assertContext($this->active);
    }

    public function context(): CoordinatedChurchTransaction
    {
        if ($this->active === null) {
            throw new LogicException('Publication requires the existing primary authority boundary.');
        }
        $this->assertContext($this->active);

        return $this->active;
    }

    /** Identity is verified against PostgreSQL, not just a mutable PHP marker. */
    public function assertContext(CoordinatedChurchTransaction $context): void
    {
        if ($this->active !== $context || DB::transactionLevel() < 1
            || DB::connection()->getPdo() !== $context->connection
            || ! $context->connection->inTransaction()
            || $this->tenant->churchId() !== $context->churchId) {
            throw new LogicException('No matching live coordinated transaction.');
        }
        $identity = DB::selectOne("SELECT pg_backend_pid() AS pid, pg_current_xact_id()::text AS xid, current_setting('app.current_church_id',true) AS church");
        if ((int) $identity->pid !== $context->backendPid || $identity->xid !== $context->transactionId || $identity->church !== $context->churchId) {
            throw new LogicException('Coordinated transaction identity changed.');
        }
    }
}
