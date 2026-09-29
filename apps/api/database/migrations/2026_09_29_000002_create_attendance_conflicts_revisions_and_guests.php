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

        $schema->table('attendance_records', function (Blueprint $table): void {
            $table->foreignId('recorded_by')->nullable()->constrained('users');
            $table->uuid('recorded_device_id')->nullable();
            $table->uuid('recorded_correlation_id')->nullable();
            $table->timestampTz('recorded_at')->nullable();
            $table->timestampTz('recorded_received_at')->nullable();
        });

        $schema->create('attendance_guests', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('church_id');
            $table->uuid('attendance_session_id');
            $table->string('display_name', 120);
            $table->string('gender', 16)->default('unspecified');
            $table->string('state', 16)->default('present');
            $table->string('status', 16)->default('pending');
            $table->foreignId('created_by')->constrained('users');
            $table->uuid('source_device_id');
            $table->uuid('source_correlation_id');
            $table->timestampTz('occurred_at');
            $table->timestampTz('received_at');
            $table->uuid('resolved_student_id')->nullable();
            $table->uuid('merged_into_guest_id')->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('users');
            $table->timestampTz('resolved_at')->nullable();
            $table->timestampsTz();
            $table->foreign(['church_id', 'attendance_session_id'])->references(['church_id', 'id'])->on('attendance_sessions');
            $table->foreign(['church_id', 'resolved_student_id'])->references(['church_id', 'id'])->on('students');
            $table->unique(['church_id', 'id']);
            $table->index(['church_id', 'attendance_session_id', 'status']);
        });
        $db->statement("ALTER TABLE attendance_guests ADD CONSTRAINT attendance_guests_merged_into_foreign FOREIGN KEY (church_id, merged_into_guest_id) REFERENCES attendance_guests (church_id, id), ADD CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 120), ADD CHECK (gender IN ('male', 'female', 'unspecified')), ADD CHECK (state = 'present'), ADD CHECK (status IN ('pending', 'promoted', 'linked', 'merged')), ADD CHECK ((status = 'pending' AND resolved_by IS NULL AND resolved_at IS NULL AND resolved_student_id IS NULL AND merged_into_guest_id IS NULL) OR (status = 'promoted' AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL AND resolved_student_id IS NOT NULL AND merged_into_guest_id IS NULL) OR (status = 'linked' AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL AND resolved_student_id IS NOT NULL AND merged_into_guest_id IS NULL) OR (status = 'merged' AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL AND merged_into_guest_id IS NOT NULL))");

        $schema->table('attendance_records', function (Blueprint $table): void {
            $table->uuid('source_guest_id')->nullable();
            $table->foreign(['church_id', 'source_guest_id'])->references(['church_id', 'id'])->on('attendance_guests');
            $table->unique(['church_id', 'source_guest_id']);
        });

        $schema->create('sync_conflicts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('church_id');
            $table->uuid('attendance_session_id');
            $table->uuid('attendance_record_id')->nullable();
            $table->uuid('incoming_event_id');
            $table->string('field', 32);
            $table->unsignedInteger('base_version');
            $table->jsonb('existing_value');
            $table->jsonb('incoming_value');
            $table->foreignId('existing_actor_id')->nullable()->constrained('users');
            $table->foreignId('incoming_actor_id')->constrained('users');
            $table->uuid('existing_device_id')->nullable();
            $table->uuid('incoming_device_id');
            $table->uuid('existing_correlation_id')->nullable();
            $table->uuid('incoming_correlation_id');
            $table->timestampTz('existing_occurred_at')->nullable();
            $table->timestampTz('existing_received_at')->nullable();
            $table->timestampTz('incoming_occurred_at');
            $table->timestampTz('incoming_received_at');
            $table->boolean('was_finalized');
            $table->string('status', 16)->default('open');
            $table->string('resolution', 16)->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('users');
            $table->timestampTz('resolved_at')->nullable();
            $table->timestampsTz();
            $table->foreign(['church_id', 'attendance_session_id'])->references(['church_id', 'id'])->on('attendance_sessions');
            $table->foreign(['church_id', 'attendance_record_id'])->references(['church_id', 'id'])->on('attendance_records');
            $table->unique(['church_id', 'id']);
            $table->unique(['church_id', 'incoming_device_id', 'incoming_event_id']);
            $table->index(['church_id', 'status', 'created_at']);
        });
        $db->statement("ALTER TABLE sync_conflicts ADD CHECK (field IN ('state', 'session')), ADD CHECK (status IN ('open', 'resolved')), ADD CHECK (resolution IS NULL OR resolution IN ('existing', 'incoming')), ADD CHECK ((status = 'open' AND resolution IS NULL AND resolved_by IS NULL AND resolved_at IS NULL) OR (status = 'resolved' AND resolution IS NOT NULL AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL))");

        $schema->create('attendance_revisions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('church_id');
            $table->uuid('attendance_session_id');
            $table->uuid('attendance_record_id');
            $table->uuid('sync_conflict_id')->nullable();
            $table->string('before_state', 16);
            $table->string('after_state', 16);
            $table->foreignId('original_actor_id')->nullable()->constrained('users');
            $table->foreignId('resolving_actor_id')->constrained('users');
            $table->string('reason', 500);
            $table->timestampTz('revised_at');
            $table->timestampsTz();
            $table->foreign(['church_id', 'attendance_session_id'])->references(['church_id', 'id'])->on('attendance_sessions');
            $table->foreign(['church_id', 'attendance_record_id'])->references(['church_id', 'id'])->on('attendance_records');
            $table->foreign(['church_id', 'sync_conflict_id'])->references(['church_id', 'id'])->on('sync_conflicts');
            $table->unique(['church_id', 'id']);
            $table->unique(['church_id', 'sync_conflict_id']);
            $table->index(['church_id', 'attendance_record_id', 'revised_at']);
        });
        $db->statement("ALTER TABLE attendance_revisions ADD CHECK (before_state IN ('present', 'absent')), ADD CHECK (after_state IN ('present', 'absent')), ADD CHECK (char_length(btrim(reason)) BETWEEN 1 AND 500)");

        foreach (['attendance_guests', 'sync_conflicts', 'attendance_revisions'] as $table) {
            $db->unprepared("ALTER TABLE {$table} ENABLE ROW LEVEL SECURITY;
                ALTER TABLE {$table} FORCE ROW LEVEL SECURITY;
                CREATE POLICY {$table}_tenant ON {$table}
                USING (church_id = NULLIF(current_setting('app.current_church_id', true), '')::uuid)
                WITH CHECK (church_id = NULLIF(current_setting('app.current_church_id', true), '')::uuid);
                REVOKE ALL ON {$table} FROM PUBLIC;");
        }
        $db->statement("GRANT SELECT, INSERT ON attendance_guests, sync_conflicts TO \"{$role}\"");
        $db->statement("GRANT UPDATE (status, resolved_student_id, merged_into_guest_id, resolved_by, resolved_at, updated_at) ON attendance_guests TO \"{$role}\"");
        $db->statement("GRANT UPDATE (status, resolution, resolved_by, resolved_at, updated_at) ON sync_conflicts TO \"{$role}\"");
        $db->statement("GRANT SELECT, INSERT ON attendance_revisions TO \"{$role}\"");
    }

    public function down(): void
    {
        $db = DB::connection($this->getConnection());
        foreach (['attendance_revisions', 'sync_conflicts', 'attendance_guests'] as $table) {
            $db->unprepared("DROP POLICY IF EXISTS {$table}_tenant ON {$table}");
        }
        $schema = Schema::connection($this->getConnection());
        $schema->dropIfExists('attendance_revisions');
        $schema->dropIfExists('sync_conflicts');
        $schema->table('attendance_records', function (Blueprint $table): void {
            $table->dropForeign(['church_id', 'source_guest_id']);
            $table->dropUnique(['church_id', 'source_guest_id']);
            $table->dropColumn('source_guest_id');
        });
        $schema->dropIfExists('attendance_guests');
        $schema->table('attendance_records', function (Blueprint $table): void {
            $table->dropForeign(['recorded_by']);
            $table->dropColumn(['recorded_by', 'recorded_device_id', 'recorded_correlation_id', 'recorded_at', 'recorded_received_at']);
        });
    }
};
