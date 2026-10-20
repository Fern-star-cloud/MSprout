<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $db = DB::connection($this->getConnection());
        $db->unprepared(<<<'SQL'
            ALTER TABLE offline_recovery_runs
                ADD schema_version varchar(32),
                ADD request_digest char(64) CHECK(request_digest ~ '^[a-f0-9]{64}$'),
                ADD authority_digest char(64) CHECK(authority_digest ~ '^[a-f0-9]{64}$'),
                ADD CHECK(num_nonnulls(schema_version,request_digest,authority_digest) IN (0,3));
            SQL);
        // Inherited cleanup is no longer an ordinary web/runtime capability.
        $runtime = config('database.runtime_role');
        $maintenance = config('maintenance.role');
        foreach (array_filter([$runtime, $maintenance]) as $role) {
            if (! is_string($role) || ! preg_match('/\A[a-z_][a-z0-9_]*\z/', $role)) {
                throw new RuntimeException('Invalid recovery authority role.');
            }
        }
        $db->unprepared(str_replace('__MAINTENANCE_ROLE__', $maintenance ?: '', file_get_contents(database_path('sql/recovery-snapshots.sql'))));
        $db->unprepared('REVOKE ALL ON FUNCTION public.cleanup_recovery_pages(uuid) FROM PUBLIC,"'.$runtime.'"');
        foreach ($db->select("SELECT r.rolname FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a JOIN pg_roles r ON r.oid=a.grantee WHERE p.oid='public.cleanup_recovery_pages(uuid)'::regprocedure AND a.grantee<>p.proowner") as $grant) {
            $db->unprepared('REVOKE ALL ON FUNCTION public.cleanup_recovery_pages(uuid) FROM "'.str_replace('"', '""', $grant->rolname).'"');
        }
        if ($maintenance) {
            $role = $db->selectOne('SELECT oid,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolinherit,rolreplication,rolcanlogin FROM pg_roles WHERE rolname=?', [$maintenance]);
            if (! $role || $maintenance === $runtime || $role->rolsuper || $role->rolbypassrls || $role->rolcreatedb
                || $role->rolcreaterole || $role->rolinherit || $role->rolreplication || ! $role->rolcanlogin
                || $db->scalar('SELECT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=? OR roleid=?)', [$role->oid, $role->oid])
                || $db->scalar('SELECT EXISTS(SELECT 1 FROM pg_database WHERE datdba=?) OR EXISTS(SELECT 1 FROM pg_class WHERE relowner=?) OR EXISTS(SELECT 1 FROM pg_proc WHERE proowner=?)', [$role->oid, $role->oid, $role->oid])) {
                throw new RuntimeException('Recovery maintenance requires the independently restricted non-owner LOGIN.');
            }
            // CREATE OR REPLACE preserves function ACLs across schema replays.
            // Maintenance expires through audited cleanup, never general transitions.
            $db->unprepared('REVOKE ALL ON FUNCTION public.transition_recovery_run(uuid,varchar,jsonb) FROM "'.$maintenance.'"');
            $db->unprepared('GRANT EXECUTE ON FUNCTION public.cleanup_recovery_pages(uuid) TO "'.$maintenance.'";
                GRANT SELECT(id,church_id,schema_version,expires_at,pages_purged_at) ON public.offline_recovery_runs TO "'.$maintenance.'";');
        }
    }

    public function down(): void
    {
        throw new RuntimeException('Snapshot evidence is retained; destructive rollback requires separate authorization.');
    }
};
