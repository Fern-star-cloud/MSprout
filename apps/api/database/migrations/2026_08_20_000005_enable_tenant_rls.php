<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $connection = DB::connection($this->getConnection());

        if ($connection->getDriverName() !== 'pgsql') {
            throw new RuntimeException('Tenant RLS migrations require PostgreSQL.');
        }

        $runtimeRole = config('database.runtime_role');

        if (! is_string($runtimeRole) || preg_match('/\A[a-z_][a-z0-9_]*\z/', $runtimeRole) !== 1) {
            throw new RuntimeException('DB_RUNTIME_USERNAME must be a safe PostgreSQL role identifier.');
        }

        $quotedRuntimeRole = '"'.str_replace('"', '""', $runtimeRole).'"';

        $connection->unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION enforce_exactly_one_active_church_owner()
            RETURNS trigger
            LANGUAGE plpgsql
            AS $$
            DECLARE
                affected_church_id uuid;
                active_owner_count integer;
            BEGIN
                IF TG_TABLE_NAME = 'churches' THEN
                    affected_church_id := COALESCE(NEW.id, OLD.id);
                ELSE
                    affected_church_id := COALESCE(NEW.church_id, OLD.church_id);
                END IF;

                IF EXISTS (SELECT 1 FROM churches WHERE id = affected_church_id) THEN
                    SELECT count(*)
                    INTO active_owner_count
                    FROM church_memberships
                    WHERE church_id = affected_church_id
                      AND role = 'owner'
                      AND status = 'active';

                    IF active_owner_count <> 1 THEN
                        RAISE EXCEPTION 'church must have exactly one active owner'
                            USING ERRCODE = '23514';
                    END IF;
                END IF;

                RETURN NULL;
            END;
            $$
            SQL);

        $connection->unprepared(<<<'SQL'
            CREATE CONSTRAINT TRIGGER churches_exactly_one_active_owner
            AFTER INSERT OR UPDATE OR DELETE ON churches
            DEFERRABLE INITIALLY DEFERRED
            FOR EACH ROW
            EXECUTE FUNCTION enforce_exactly_one_active_church_owner()
            SQL);
        $connection->unprepared(<<<'SQL'
            CREATE CONSTRAINT TRIGGER memberships_exactly_one_active_owner
            AFTER INSERT OR UPDATE OR DELETE ON church_memberships
            DEFERRABLE INITIALLY DEFERRED
            FOR EACH ROW
            EXECUTE FUNCTION enforce_exactly_one_active_church_owner()
            SQL);

        $connection->unprepared(<<<'SQL'
            ALTER TABLE churches ENABLE ROW LEVEL SECURITY;
            ALTER TABLE churches FORCE ROW LEVEL SECURITY;
            CREATE POLICY churches_tenant_isolation ON churches
                USING (id = NULLIF(current_setting('app.current_church_id', true), '')::uuid)
                WITH CHECK (id = NULLIF(current_setting('app.current_church_id', true), '')::uuid);

            ALTER TABLE church_memberships ENABLE ROW LEVEL SECURITY;
            ALTER TABLE church_memberships FORCE ROW LEVEL SECURITY;
            CREATE POLICY church_memberships_tenant_isolation ON church_memberships
                USING (church_id = NULLIF(current_setting('app.current_church_id', true), '')::uuid)
                WITH CHECK (church_id = NULLIF(current_setting('app.current_church_id', true), '')::uuid);
            SQL);

        $connection->unprepared(<<<SQL
            REVOKE ALL ON TABLE churches, church_memberships FROM PUBLIC;
            REVOKE ALL ON TABLE churches, church_memberships FROM {$quotedRuntimeRole};
            GRANT USAGE ON SCHEMA public TO {$quotedRuntimeRole};
            GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE users, churches, church_memberships TO {$quotedRuntimeRole};
            GRANT USAGE, SELECT ON SEQUENCE users_id_seq TO {$quotedRuntimeRole};
            SQL);
    }

    public function down(): void
    {
        $connection = DB::connection($this->getConnection());

        $connection->unprepared(<<<'SQL'
            DROP TRIGGER IF EXISTS memberships_exactly_one_active_owner ON church_memberships;
            DROP TRIGGER IF EXISTS churches_exactly_one_active_owner ON churches;
            DROP FUNCTION IF EXISTS enforce_exactly_one_active_church_owner();
            DROP POLICY IF EXISTS church_memberships_tenant_isolation ON church_memberships;
            DROP POLICY IF EXISTS churches_tenant_isolation ON churches;
            ALTER TABLE church_memberships DISABLE ROW LEVEL SECURITY;
            ALTER TABLE churches DISABLE ROW LEVEL SECURITY;
            SQL);
    }
};
