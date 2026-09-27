<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $role = config('database.runtime_role');
        if (! is_string($role) || ! preg_match('/\A[a-z_][a-z0-9_]*\z/', $role)) {
            throw new RuntimeException('Invalid runtime role.');
        }
        DB::connection($this->getConnection())->unprepared(<<<SQL
            CREATE TABLE security_events (LIKE audit_events INCLUDING DEFAULTS INCLUDING INDEXES);
            ALTER TABLE security_events ADD CHECK (category = 'security');
            ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
            ALTER TABLE security_events FORCE ROW LEVEL SECURITY;
            CREATE POLICY security_events_scope ON security_events
                USING (church_id IS NULL OR church_id = NULLIF(current_setting('app.current_church_id', true), '')::uuid)
                WITH CHECK (church_id IS NULL OR church_id = NULLIF(current_setting('app.current_church_id', true), '')::uuid);
            REVOKE ALL ON security_events FROM PUBLIC;
            GRANT SELECT, INSERT ON security_events TO "{$role}";
            REVOKE UPDATE, DELETE, TRUNCATE ON security_events FROM "{$role}";
            SQL);
    }

    public function down(): void
    {
        throw new LogicException('Security evidence must be retained by a forward migration.');
    }
};
