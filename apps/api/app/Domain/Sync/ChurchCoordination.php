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
    public function __construct(private readonly TenantContext $tenant) {}

    public function run(Request $request, Closure $operation, ?string $ministryId = null): mixed
    {
        if (DB::transactionLevel() < 1) {
            throw new LogicException('Church coordination requires an outer tenant transaction.');
        }
        $churchId = $this->tenant->churchId();
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

        return $operation($member, $actor);
    }
}
