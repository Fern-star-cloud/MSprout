<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $db = DB::connection($this->getConnection());
        $role = config('database.runtime_role');
        if (! is_string($role) || ! preg_match('/\A[a-z_][a-z0-9_]*\z/', $role)) {
            throw new RuntimeException('Invalid runtime role.');
        }
        // Laravel runs PostgreSQL migrations in one transaction. Block old writers until the copy and grants commit.
        $db->statement('LOCK TABLE membership_audits, platform_application_audits IN ACCESS EXCLUSIVE MODE');
        // The migration table owner must see every church, including when it is not a superuser.
        $db->statement('ALTER TABLE membership_audits NO FORCE ROW LEVEL SECURITY');
        $db->statement('SET LOCAL row_security = off');
        if ($db->table('membership_audits')->join('platform_application_audits', 'membership_audits.id', '=', 'platform_application_audits.id')->exists()) {
            throw new RuntimeException('Conflicting legacy audit identities; resolve with a reviewed forward migration.');
        }
        Schema::connection($this->getConnection())->create('audit_events', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('category', 16);
            $t->uuid('church_id')->nullable();
            $t->string('actor_type', 24);
            $t->string('actor_id', 36)->nullable();
            $t->string('action', 64);
            $t->string('target_type', 32);
            $t->string('target_id', 36)->nullable();
            $t->string('result', 16);
            $t->uuid('device_id')->nullable();
            $t->uuid('sync_batch_id')->nullable();
            $t->uuid('correlation_id');
            $t->jsonb('metadata_json');
            $t->timestampTz('occurred_at');
            $t->index(['church_id', 'occurred_at', 'id']);
            $t->index(['category', 'occurred_at', 'id']);
            $t->index(['church_id', 'actor_id', 'occurred_at', 'id']);
        });
        // Copy evidence before locking the old writers out. No old row is rewritten or removed.
        $db->unprepared(<<<SQL
            INSERT INTO audit_events (id, category, actor_type, actor_id, action, target_type, target_id, result, correlation_id, metadata_json, occurred_at)
            SELECT id, 'platform', 'platform_admin', actor_id::text, action, 'application', application_id::text, 'success', correlation_id,
                jsonb_strip_nulls(jsonb_build_object('applicant_id', applicant_id, 'decision_category', category)), occurred_at FROM platform_application_audits;
            INSERT INTO audit_events (id, category, church_id, actor_type, actor_id, action, target_type, target_id, result, correlation_id, metadata_json, occurred_at)
            SELECT id, 'church', church_id, 'user', actor_id::text, action,
                CASE WHEN action IN ('teacher.invited', 'invitation.accepted', 'invitation.revoked') THEN 'invitation' ELSE 'membership' END,
                target_id::text, result, correlation_id, jsonb_strip_nulls(jsonb_build_object('risk', risk, 'previous_owner_id', previous_owner_id)), occurred_at FROM membership_audits;
            ALTER TABLE audit_events ADD CHECK ((category = 'church' AND church_id IS NOT NULL) OR (category = 'platform' AND church_id IS NULL));
            ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
            ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
            CREATE POLICY audit_events_scope ON audit_events
                USING (church_id = NULLIF(current_setting('app.current_church_id', true), '')::uuid OR (category = 'platform' AND church_id IS NULL))
                WITH CHECK (church_id = NULLIF(current_setting('app.current_church_id', true), '')::uuid OR (category = 'platform' AND church_id IS NULL));
            REVOKE ALL ON audit_events FROM PUBLIC;
            GRANT SELECT, INSERT ON audit_events TO "{$role}";
            REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM "{$role}";
            REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON membership_audits, platform_application_audits FROM "{$role}";
            ALTER TABLE membership_audits FORCE ROW LEVEL SECURITY;
            SET LOCAL row_security = on;
            SQL);
    }

    public function down(): void
    {
        // A destructive downgrade would lose new evidence. Restore an application version compatible with this schema.
        throw new LogicException('Audit consolidation requires a forward migration; evidence must be retained.');
    }
};
