<?php

namespace App\Domain\Sync;

use App\Support\Tenancy\TenantContext;
use Closure;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use LogicException;

/** Internal console/queue contract only; no maintenance caller is converted by C. */
final readonly class TrustedSystemCoordination
{
    public function __construct(private TenantContext $tenant, private ChurchCoordination $coordination) {}

    public function run(string $churchId, TrustedSystemPurpose $purpose, Closure $operation): mixed
    {
        if (! app()->runningInConsole() || request()->route() !== null
            || Auth::guard('web')->check() || Auth::guard('platform')->check()) {
            throw new AuthorizationException;
        }
        $role = DB::selectOne('SELECT current_user AS name, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolinherit FROM pg_roles WHERE rolname=current_user');
        $table = DB::selectOne("SELECT relrowsecurity, relforcerowsecurity, relowner=current_user::regrole AS owns FROM pg_class WHERE oid='public.churches'::regclass");
        if ($role->name !== config('database.runtime_role') || $role->rolsuper || $role->rolbypassrls
            || $role->rolcreatedb || $role->rolcreaterole || $role->rolinherit
            || $table->owns || ! $table->relrowsecurity || ! $table->relforcerowsecurity) {
            throw new LogicException('Trusted coordination requires the restricted forced-RLS runtime.');
        }

        return $this->tenant->runForCoordinatedSystem($churchId, $purpose,
            fn () => $this->coordination->runSystem($purpose, $operation));
    }
}
