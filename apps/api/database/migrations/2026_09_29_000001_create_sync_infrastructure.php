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
        $schema = Schema::connection($this->getConnection());
        $role = config('database.runtime_role');
        if (! is_string($role) || ! preg_match('/\A[a-z_][a-z0-9_]*\z/', $role)) {
            throw new RuntimeException('Invalid runtime role.');
        }

        $schema->create('sync_events', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('church_id');
            $table->uuid('device_id');
            $table->uuid('client_event_id');
            $table->uuid('batch_id');
            $table->foreignId('actor_id')->constrained('users');
            $table->char('payload_hash', 64);
            $table->string('result_status', 16);
            $table->string('result_reason', 64)->nullable();
            $table->uuid('result_record_id')->nullable();
            $table->unsignedInteger('result_version')->nullable();
            $table->timestampTz('received_at');
            $table->uuid('correlation_id');
            $table->foreign('church_id')->references('id')->on('churches');
            $table->unique(['church_id', 'device_id', 'client_event_id']);
            $table->index(['church_id', 'received_at']);
        });
        $db->statement("ALTER TABLE sync_events ADD CHECK (payload_hash ~ '^[a-f0-9]{64}$'), ADD CHECK (result_status IN ('accepted', 'conflict', 'rejected')), ADD CHECK (result_version IS NULL OR result_version >= 1)");

        $schema->create('change_feed', function (Blueprint $table): void {
            $table->bigIncrements('sequence');
            $table->uuid('id')->unique();
            $table->uuid('church_id');
            $table->uuid('ministry_id')->nullable();
            $table->uuid('target_membership_id')->nullable();
            $table->string('entity_type', 32);
            $table->uuid('entity_id');
            $table->unsignedInteger('entity_version');
            $table->string('action', 16);
            $table->jsonb('payload_json')->nullable();
            $table->timestampTz('created_at');
            $table->foreign('church_id')->references('id')->on('churches');
            $table->foreign(['church_id', 'ministry_id'])->references(['church_id', 'id'])->on('ministries');
            $table->foreign(['church_id', 'target_membership_id'])->references(['church_id', 'id'])->on('church_memberships');
            $table->index(['church_id', 'sequence']);
            $table->index(['church_id', 'target_membership_id', 'sequence']);
        });
        $db->statement("ALTER TABLE change_feed ADD CHECK (entity_version >= 1), ADD CHECK (action IN ('upsert', 'tombstone'))");

        $schema->create('device_cursors', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('church_id');
            $table->uuid('membership_id');
            $table->uuid('device_id');
            $table->unsignedBigInteger('cursor')->default(0);
            $table->timestampTz('updated_at');
            $table->foreign(['church_id', 'membership_id'])->references(['church_id', 'id'])->on('church_memberships');
            $table->unique(['membership_id', 'device_id']);
        });

        foreach (['sync_events', 'change_feed', 'device_cursors'] as $table) {
            $db->unprepared("ALTER TABLE {$table} ENABLE ROW LEVEL SECURITY;
                ALTER TABLE {$table} FORCE ROW LEVEL SECURITY;
                CREATE POLICY {$table}_tenant ON {$table}
                USING (church_id = NULLIF(current_setting('app.current_church_id', true), '')::uuid)
                WITH CHECK (church_id = NULLIF(current_setting('app.current_church_id', true), '')::uuid);
                REVOKE ALL ON {$table} FROM PUBLIC;");
        }
        $db->unprepared("GRANT SELECT, INSERT ON sync_events, change_feed TO \"{$role}\";
            GRANT SELECT, INSERT, UPDATE ON device_cursors TO \"{$role}\";
            GRANT USAGE, SELECT ON SEQUENCE change_feed_sequence_seq TO \"{$role}\";");
    }

    public function down(): void
    {
        $db = DB::connection($this->getConnection());
        foreach (['device_cursors', 'change_feed', 'sync_events'] as $table) {
            $db->unprepared("DROP POLICY IF EXISTS {$table}_tenant ON {$table}");
        }
        $schema = Schema::connection($this->getConnection());
        $schema->dropIfExists('device_cursors');
        $schema->dropIfExists('change_feed');
        $schema->dropIfExists('sync_events');
    }
};
