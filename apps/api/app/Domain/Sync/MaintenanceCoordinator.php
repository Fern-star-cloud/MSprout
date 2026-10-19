<?php

namespace App\Domain\Sync;

use Closure;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use LogicException;

final class MaintenanceCoordinator
{
    public function assertWorker(): void
    {
        if (! app()->runningInConsole() || request()->route() !== null
            || Auth::guard('web')->check() || Auth::guard('platform')->check()) {
            throw new AuthorizationException;
        }
        if (DB::transactionLevel() !== 0) {
            throw new LogicException('Maintenance owns independent per-church transactions.');
        }
        $role = DB::selectOne('SELECT oid,current_user AS name,session_user AS authenticated,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolinherit,rolreplication FROM pg_roles WHERE rolname=current_user');
        if (config('maintenance.process') !== true || ! config('maintenance.role')
            || $role->name !== config('maintenance.role') || $role->name === config('database.runtime_role') || $role->rolsuper || $role->rolbypassrls
            || $role->authenticated !== $role->name || $role->rolcreatedb || $role->rolcreaterole || $role->rolinherit || $role->rolreplication
            || DB::scalar('SELECT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=? OR roleid=?)', [$role->oid, $role->oid])
            || ! DB::scalar("SELECT has_function_privilege(current_user,'public.maintenance_church_ids()','EXECUTE')")) {
            throw new LogicException('Maintenance requires its independently authenticated restricted process.');
        }
    }

    public function each(TrustedSystemPurpose $purpose, Closure $operation): int
    {
        $this->assertWorker();
        if (! in_array($purpose, [TrustedSystemPurpose::RetentionCleanup, TrustedSystemPurpose::RevokedDeviceCleanup], true)) {
            throw new LogicException('Unsupported maintenance purpose.');
        }
        $total = 0;
        foreach (DB::select('SELECT public.maintenance_church_ids() AS id') as $church) {
            $total += app(TrustedSystemCoordination::class)->run($church->id, $purpose,
                fn ($context): int => (int) $operation($church->id, $context));
        }

        return $total;
    }
}
