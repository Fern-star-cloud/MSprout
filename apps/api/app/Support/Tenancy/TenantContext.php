<?php

namespace App\Support\Tenancy;

use App\Actions\Invitations\VerifiedInvitationAuthority;
use App\Domain\Sync\TrustedSystemPurpose;
use App\Enums\ChurchRole;
use App\Models\Church;
use App\Models\ChurchMembership;
use Closure;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;
use LogicException;

final class TenantContext
{
    private ?string $churchId = null;

    private ?ChurchRole $role = null;

    private ?TrustedSystemPurpose $systemPurpose = null;

    public function churchId(): string
    {
        return $this->churchId ?? throw new LogicException('No tenant context is active.');
    }

    public function role(): ChurchRole
    {
        return $this->role ?? throw new LogicException('No authorized tenant role is active.');
    }

    public function run(string $churchId, Closure $callback): mixed
    {
        if (! Str::isUuid($churchId)) {
            throw new InvalidArgumentException('The church identifier must be a UUID.');
        }

        $churchId = Str::lower($churchId);

        if ($this->churchId !== null) {
            if (! hash_equals($this->churchId, $churchId)) {
                throw new LogicException('A different tenant context cannot be nested.');
            }

            return $callback();
        }

        return DB::connection()->transaction(function () use ($churchId, $callback): mixed {
            DB::selectOne(
                "SELECT set_config('app.current_church_id', ?, true)",
                [$churchId],
            );

            $userId = Auth::id();

            if ($userId === null) {
                throw new AuthorizationException;
            }

            $membership = ChurchMembership::query()
                ->where('church_id', $churchId)
                ->where('user_id', $userId)
                ->where('status', 'active')
                ->first();

            if ($membership === null || ! Church::whereKey($churchId)->where('status', 'active')->exists()) {
                throw new AuthorizationException;
            }

            $this->churchId = $churchId;
            $this->role = $membership->role;

            try {
                return $callback();
            } finally {
                $this->churchId = null;
                $this->role = null;
            }
        });
    }

    /**
     * Own the transaction for a verified signed invitation before membership exists.
     */
    public function runForSignedInvitation(VerifiedInvitationAuthority $authority, Closure $callback): mixed
    {
        if ($this->churchId !== null || DB::transactionLevel() !== 0) {
            throw new LogicException('Invitation scope must own its outer transaction.');
        }

        return DB::transaction(function () use ($authority, $callback): mixed {
            DB::selectOne("SELECT set_config('app.current_church_id', ?, true)", [$authority->churchId()]);
            $this->churchId = $authority->churchId();
            $this->role = null;
            try {
                return $callback();
            } finally {
                // The owning commit/rollback restores SET LOCAL, including aborted SQL.
                $this->churchId = null;
                $this->role = null;
            }
        });
    }

    public function runForSystem(string $churchId, Closure $callback): mixed
    {
        if (! Str::isUuid($churchId)) {
            throw new InvalidArgumentException('The church identifier must be a UUID.');
        }

        $churchId = Str::lower($churchId);
        if ($this->churchId !== null) {
            if (! hash_equals($this->churchId, $churchId) || $this->role !== null) {
                throw new LogicException('A different tenant context cannot be nested.');
            }

            return $callback();
        }

        return DB::connection()->transaction(function () use ($churchId, $callback): mixed {
            DB::selectOne("SELECT set_config('app.current_church_id', ?, true)", [$churchId]);
            if (! Church::whereKey($churchId)->where('status', 'active')->exists()) {
                throw new AuthorizationException;
            }
            $this->churchId = $churchId;
            $this->role = null;

            try {
                return $callback();
            } finally {
                $this->churchId = null;
            }
        });
    }

    public function runForCoordinatedSystem(string $churchId, TrustedSystemPurpose $purpose, Closure $callback): mixed
    {
        if (! app()->runningInConsole() || request()->route() !== null
            || Auth::guard('web')->check() || Auth::guard('platform')->check()) {
            throw new AuthorizationException;
        }
        if (! Str::isUuid($churchId)) {
            throw new InvalidArgumentException('The church identifier must be a UUID.');
        }
        $churchId = Str::lower($churchId);
        if ($this->churchId !== null) {
            if ($this->churchId !== $churchId || $this->role !== null || $this->systemPurpose !== $purpose) {
                throw new LogicException('A different trusted authority cannot be nested.');
            }

            return $callback();
        }
        if (DB::transactionLevel() !== 0) {
            throw new LogicException('System scope must own its outer transaction.');
        }

        return DB::transaction(function () use ($churchId, $purpose, $callback): mixed {
            DB::selectOne("SELECT set_config('app.current_church_id', ?, true)", [$churchId]);
            $this->churchId = $churchId;
            $this->role = null;
            $this->systemPurpose = $purpose;
            try {
                return $callback();
            } finally {
                $this->churchId = null;
                $this->role = null;
                $this->systemPurpose = null;
            }
        });
    }

    public function assertSystemPurpose(TrustedSystemPurpose $purpose): void
    {
        if ($this->churchId === null || $this->role !== null || $this->systemPurpose !== $purpose) {
            throw new LogicException('No matching trusted system scope.');
        }
    }
}
