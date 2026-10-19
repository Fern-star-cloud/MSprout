<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $db = DB::connection($this->getConnection());
        $runtime = config('database.runtime_role');
        $maintenance = config('maintenance.role');
        foreach (array_filter([$runtime, $maintenance]) as $role) {
            if (! preg_match('/\A[a-z_][a-z0-9_]{0,62}\z/', $role)) {
                throw new RuntimeException('Invalid maintenance authority role.');
            }
        }
        if (! $runtime) {
            throw new RuntimeException('Runtime role is required for privilege revocation.');
        }
        $functions = 'public.maintenance_church_ids(),public.protected_user_has_memberships(bigint),'
            .'public.prune_global_operational_data(timestamptz,timestamptz),'
            .'public.prune_church_operational_data(uuid,timestamptz,timestamptz,timestamptz),'
            .'public.purge_church_revoked_device_data(uuid,timestamptz,timestamptz),'
            .'public.prune_operational_data(timestamptz,timestamptz,timestamptz,timestamptz),'
            .'public.purge_revoked_device_data(timestamptz,timestamptz)';
        $db->unprepared('REVOKE ALL ON FUNCTION '.$functions.' FROM PUBLIC,"'.$runtime.'"');
        // Remove historical grants to other principals too; retain only the reviewed owner.
        foreach ($db->select("SELECT p.oid::regprocedure::text AS signature,r.rolname FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a JOIN pg_roles r ON r.oid=a.grantee WHERE p.pronamespace='public'::regnamespace AND p.proname IN ('maintenance_church_ids','protected_user_has_memberships','prune_global_operational_data','prune_church_operational_data','purge_church_revoked_device_data','prune_operational_data','purge_revoked_device_data') AND a.grantee<>p.proowner") as $grant) {
            $db->unprepared('REVOKE ALL ON FUNCTION '.$grant->signature.' FROM "'.str_replace('"', '""', $grant->rolname).'"');
        }
        // An unprovisioned maintenance identity leaves cleanup unavailable, never on runtime.
        if (! $maintenance) {
            return;
        }
        $role = $db->selectOne('SELECT oid,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolinherit,rolreplication,rolcanlogin FROM pg_roles WHERE rolname=?', [$maintenance]);
        if (! $role || $maintenance === $runtime || $role->rolsuper || $role->rolbypassrls || $role->rolcreatedb
            || $role->rolcreaterole || $role->rolinherit || $role->rolreplication || ! $role->rolcanlogin
            || $db->scalar('SELECT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=? OR roleid=?)', [$role->oid, $role->oid])
            || $db->scalar('SELECT EXISTS(SELECT 1 FROM pg_database WHERE datdba=?) OR EXISTS(SELECT 1 FROM pg_class WHERE relowner=?) OR EXISTS(SELECT 1 FROM pg_proc WHERE proowner=?)', [$role->oid, $role->oid, $role->oid])) {
            throw new RuntimeException('Maintenance must be an independent restricted non-owner LOGIN role.');
        }
        $quoted = '"'.$maintenance.'"';
        // Current workers never invoke the two legacy global wrappers; keep them owner-only.
        $workerFunctions = 'public.maintenance_church_ids(),public.protected_user_has_memberships(bigint),'
            .'public.prune_global_operational_data(timestamptz,timestamptz),'
            .'public.prune_church_operational_data(uuid,timestamptz,timestamptz,timestamptz),'
            .'public.purge_church_revoked_device_data(uuid,timestamptz,timestamptz)';
        $db->unprepared('GRANT USAGE ON SCHEMA public TO '.$quoted.'; GRANT EXECUTE ON FUNCTION '.$workerFunctions.' TO '.$quoted);
        // No queue access, domain writer, feed/receipt writer, or broad table ownership.
        $db->unprepared('GRANT SELECT ON public.churches,public.users,public.church_applications,public.sessions,public.password_reset_tokens TO '.$quoted.';
            GRANT UPDATE(id) ON public.churches,public.users TO '.$quoted.';
            GRANT DELETE ON public.users,public.sessions,public.password_reset_tokens TO '.$quoted.';
            GRANT UPDATE(church_name,city,address,timezone,duplicate_key,reason,purged_at,updated_at) ON public.church_applications TO '.$quoted.';
            GRANT INSERT ON public.audit_events TO '.$quoted);
    }

    public function down(): void
    {
        throw new RuntimeException('Maintenance authority requires a reviewed forward recovery plan.');
    }
};
