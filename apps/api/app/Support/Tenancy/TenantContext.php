<?php

namespace App\Support\Tenancy;

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
}
