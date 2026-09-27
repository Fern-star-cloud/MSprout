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

        $schema->table('ministries', function (Blueprint $t) {
            $t->unsignedInteger('version')->default(1);
            $t->timestampTz('deleted_at')->nullable();
            $t->index(['church_id', 'deleted_at', 'name']);
        });
        $schema->create('students', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('church_id');
            $t->string('first_name', 120);
            $t->string('middle_name', 120)->nullable();
            $t->string('last_name', 120);
            $t->string('preferred_name', 120)->nullable();
            $t->string('suffix', 40)->nullable();
            $t->date('date_of_birth')->nullable();
            $t->string('gender', 16)->default('unspecified');
            $t->string('external_reference', 120)->nullable();
            $t->unsignedInteger('version')->default(1);
            $t->timestampTz('deleted_at')->nullable();
            $t->timestampsTz();
            $t->foreign('church_id')->references('id')->on('churches');
            $t->unique(['church_id', 'id']);
            $t->index(['church_id', 'deleted_at', 'last_name', 'first_name']);
        });
        $db->statement("ALTER TABLE students ADD CHECK (gender IN ('male', 'female', 'unspecified')), ADD CHECK (version >= 1), ADD CHECK (date_of_birth IS NULL OR date_of_birth <= CURRENT_DATE)");
        $db->statement('CREATE UNIQUE INDEX students_external_reference_unique ON students (church_id, lower(external_reference)) WHERE external_reference IS NOT NULL');
        $schema->create('enrollments', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('church_id');
            $t->uuid('student_id');
            $t->uuid('ministry_id');
            $t->unsignedInteger('version')->default(1);
            $t->timestampTz('deleted_at')->nullable();
            $t->timestampsTz();
            $t->foreign(['church_id', 'student_id'])->references(['church_id', 'id'])->on('students');
            $t->foreign(['church_id', 'ministry_id'])->references(['church_id', 'id'])->on('ministries');
            $t->unique(['church_id', 'student_id', 'ministry_id']);
            $t->index(['church_id', 'ministry_id', 'deleted_at', 'student_id']);
        });
        $db->statement('ALTER TABLE enrollments ADD CHECK (version >= 1)');
        foreach (['students', 'enrollments'] as $table) {
            $db->unprepared("ALTER TABLE {$table} ENABLE ROW LEVEL SECURITY;
                ALTER TABLE {$table} FORCE ROW LEVEL SECURITY;
                CREATE POLICY {$table}_tenant ON {$table}
                USING (church_id = NULLIF(current_setting('app.current_church_id', true), '')::uuid)
                WITH CHECK (church_id = NULLIF(current_setting('app.current_church_id', true), '')::uuid);
                REVOKE ALL ON {$table} FROM PUBLIC;
                GRANT SELECT, INSERT, UPDATE ON {$table} TO \"{$role}\";");
        }
        $db->unprepared("GRANT UPDATE ON ministries TO \"{$role}\"");
    }

    public function down(): void
    {
        $db = DB::connection($this->getConnection());
        $db->unprepared('DROP POLICY IF EXISTS students_tenant ON students; DROP POLICY IF EXISTS enrollments_tenant ON enrollments');
        Schema::connection($this->getConnection())->dropIfExists('enrollments');
        Schema::connection($this->getConnection())->dropIfExists('students');
        Schema::connection($this->getConnection())->table('ministries', function (Blueprint $t) {
            $t->dropIndex(['church_id', 'deleted_at', 'name']);
            $t->dropColumn(['version', 'deleted_at']);
        });
    }
};
