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

        $schema->create('attendance_sessions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('church_id');
            $table->uuid('ministry_id');
            $table->date('attendance_date');
            $table->string('status', 24)->default('draft');
            $table->unsignedInteger('version')->default(1);
            $table->foreignId('finalized_by')->nullable()->constrained('users');
            $table->timestampTz('finalized_at')->nullable();
            $table->timestampTz('deleted_at')->nullable();
            $table->timestampsTz();
            $table->foreign(['church_id', 'ministry_id'])->references(['church_id', 'id'])->on('ministries');
            $table->unique(['church_id', 'id']);
            $table->unique(['church_id', 'ministry_id', 'attendance_date']);
            $table->index(['church_id', 'attendance_date', 'status']);
        });
        $db->statement("ALTER TABLE attendance_sessions ADD CHECK (status IN ('draft', 'finalized_pending', 'finalized', 'needs_review', 'revised')), ADD CHECK (version >= 1), ADD CHECK ((status IN ('finalized', 'revised') AND finalized_by IS NOT NULL AND finalized_at IS NOT NULL) OR status NOT IN ('finalized', 'revised'))");

        $schema->create('attendance_records', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('church_id');
            $table->uuid('attendance_session_id');
            $table->uuid('student_id');
            $table->string('state', 16)->default('unmarked');
            $table->unsignedInteger('version')->default(1);
            $table->timestampTz('deleted_at')->nullable();
            $table->timestampsTz();
            $table->foreign(['church_id', 'attendance_session_id'])->references(['church_id', 'id'])->on('attendance_sessions');
            $table->foreign(['church_id', 'student_id'])->references(['church_id', 'id'])->on('students');
            $table->unique(['church_id', 'id']);
            $table->unique(['church_id', 'attendance_session_id', 'student_id']);
            $table->index(['church_id', 'student_id', 'deleted_at']);
        });
        $db->statement("ALTER TABLE attendance_records ADD CHECK (state IN ('unmarked', 'present', 'absent')), ADD CHECK (version >= 1)");

        foreach (['attendance_sessions', 'attendance_records'] as $table) {
            $db->unprepared("ALTER TABLE {$table} ENABLE ROW LEVEL SECURITY;
                ALTER TABLE {$table} FORCE ROW LEVEL SECURITY;
                CREATE POLICY {$table}_tenant ON {$table}
                USING (church_id = NULLIF(current_setting('app.current_church_id', true), '')::uuid)
                WITH CHECK (church_id = NULLIF(current_setting('app.current_church_id', true), '')::uuid);
                REVOKE ALL ON {$table} FROM PUBLIC;
                GRANT SELECT, INSERT, UPDATE ON {$table} TO \"{$role}\";");
        }
    }

    public function down(): void
    {
        $db = DB::connection($this->getConnection());
        $db->unprepared('DROP POLICY IF EXISTS attendance_records_tenant ON attendance_records; DROP POLICY IF EXISTS attendance_sessions_tenant ON attendance_sessions');
        $schema = Schema::connection($this->getConnection());
        $schema->dropIfExists('attendance_records');
        $schema->dropIfExists('attendance_sessions');
    }
};
