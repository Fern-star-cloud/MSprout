<?php

namespace App\Domain\Sync;

use App\Enums\ChurchRole;
use App\Models\Church;
use App\Models\ChurchMembership;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use Closure;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use LogicException;

/** Explicit foundation only: no existing production caller is integrated yet. */
final class ChurchCoordination
{
    private ?CoordinatedChurchTransaction $active = null;

    public function __construct(private readonly TenantContext $tenant) {}

    public function run(Request $request, Closure $operation, ?string $ministryId = null): mixed
    {
        $churchId = $this->tenant->churchId();
        $nested = $this->active !== null;
        if ($nested) {
            $this->assertContext($this->active);
        } else {
            if (DB::transactionLevel() !== 1) {
                throw new LogicException('Acquire the primary church gate in the outer tenant transaction.');
            }
            if (DB::scalar('SHOW transaction_isolation') !== 'read committed') {
                throw new LogicException('Fresh post-wait authority requires read committed isolation.');
            }
            // TenantContext has performed reads only. Refuse a late gate, rather than
            // introducing a church/domain or church/advisory lock-order inversion.
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
        // Must precede every domain/advisory/progress lock at future integration sites.
        $church = Church::query()->whereKey($churchId)->lock('FOR NO KEY UPDATE')->first();
        $actorId = $request->user()?->getKey();
        $actor = $actorId === null ? null : User::query()->find($actorId);
        $member = ChurchMembership::query()->where('church_id', $churchId)
            ->where('user_id', $actorId)->where('status', 'active')->first();
        if ($church?->status !== 'active' || $actor === null || (string) Auth::id() !== (string) $actorId || ! $actor->hasVerifiedEmail()
            || $member === null || $member->role !== $this->tenant->role()) {
            throw new AuthorizationException;
        }
        // A role changed while waiting must restart the request, not reuse cached authority.
        if ($member->role === ChurchRole::Owner && (! $actor->hasEnabledTwoFactorAuthentication()
            || ! $request->hasSession() || $request->session()->get('church_mfa_user_id') !== $actor->getKey())) {
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

        if ($nested) {
            return $operation($member, $actor, $this->active);
        }
        $identity = DB::selectOne('SELECT pg_backend_pid() AS pid, pg_current_xact_id()::text AS xid');
        $context = new CoordinatedChurchTransaction($this, DB::connection()->getPdo(), $churchId, (int) $identity->pid, $identity->xid);
        $this->active = $context;
        try {
            return $operation($member, $actor, $context);
        } finally {
            $this->active = null;
        }
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
