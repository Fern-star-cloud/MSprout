<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $role = str_replace('"', '""', config('database.connections.pgsql.username'));
        // Bootstrap cannot set a tenant before discovering membership. This narrow
        // read capability follows the existing scheduler pattern, without changing RLS.
        // Its actor argument comes exclusively from the authenticated web guard.
        DB::connection($this->getConnection())->unprepared(<<<SQL
            CREATE OR REPLACE FUNCTION authenticated_church_workspaces(actor_id bigint)
            RETURNS TABLE (church_id uuid, name varchar, role varchar)
            LANGUAGE sql
            STABLE
            SECURITY DEFINER
            SET search_path = pg_catalog
            AS \$\$
                SELECT c.id, c.name, m.role
                FROM public.church_memberships m
                JOIN public.churches c ON c.id = m.church_id
                JOIN public.users u ON u.id = m.user_id
                WHERE m.user_id = actor_id
                  AND u.email_verified_at IS NOT NULL
                  AND m.status = 'active'
                  AND c.status = 'active'
                ORDER BY c.id
            \$\$;
            REVOKE ALL ON FUNCTION authenticated_church_workspaces(bigint) FROM PUBLIC;
            GRANT EXECUTE ON FUNCTION authenticated_church_workspaces(bigint) TO "{$role}";
            SQL);
    }

    public function down(): void
    {
        DB::connection($this->getConnection())->unprepared('DROP FUNCTION IF EXISTS authenticated_church_workspaces(bigint)');
    }
};
