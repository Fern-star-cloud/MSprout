<?php

namespace App\Domain\Sync;

use App\Actions\Invitations\VerifiedInvitationAuthority;
use App\Support\Tenancy\TenantContext;
use Closure;
use Illuminate\Http\Request;

final readonly class SignedInvitationCoordination
{
    public function __construct(private TenantContext $tenant, private ChurchCoordination $coordination) {}

    public function run(Request $request, VerifiedInvitationAuthority $authority, Closure $operation): mixed
    {
        return $this->tenant->runForSignedInvitation($authority,
            fn () => $this->coordination->runInvitation($request, $authority, $operation));
    }
}
