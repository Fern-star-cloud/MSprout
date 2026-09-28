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

        $schema->create('import_batches', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('church_id');
            $table->foreignId('uploaded_by_user_id')->constrained('users');
            $table->string('state', 20);
            $table->char('file_sha256', 64);
            $table->string('file_extension', 4);
            $table->unsignedSmallInteger('total_rows')->default(0);
            $table->unsignedSmallInteger('valid_rows')->default(0);
            $table->unsignedSmallInteger('invalid_rows')->default(0);
            $table->unsignedSmallInteger('duplicate_rows')->default(0);
            $table->unsignedSmallInteger('needs_mapping_rows')->default(0);
            $table->uuid('commit_key')->nullable();
            $table->jsonb('result_json')->nullable();
            $table->timestampTz('expires_at');
            $table->timestampTz('committed_at')->nullable();
            $table->timestampsTz();
            $table->foreign('church_id')->references('id')->on('churches');
            $table->unique(['church_id', 'id']);
            $table->unique(['church_id', 'commit_key']);
            $table->index(['church_id', 'state', 'expires_at']);
        });
        $db->statement("ALTER TABLE import_batches ADD CHECK (state IN ('uploaded', 'previewed', 'committing', 'completed', 'failed', 'expired')), ADD CHECK (total_rows <= 500)");

        $schema->create('import_rows', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('church_id');
            $table->uuid('import_batch_id');
            $table->unsignedSmallInteger('row_number');
            $table->string('status', 20);
            $table->string('outcome', 24)->nullable();
            $table->jsonb('source_data');
            $table->jsonb('normalized_data');
            $table->jsonb('ministry_names');
            $table->jsonb('ministry_ids');
            $table->jsonb('unknown_ministries');
            $table->jsonb('errors');
            $table->uuid('student_id')->nullable();
            $table->timestampsTz();
            $table->foreign(['church_id', 'import_batch_id'])->references(['church_id', 'id'])->on('import_batches');
            $table->foreign(['church_id', 'student_id'])->references(['church_id', 'id'])->on('students');
            $table->unique(['church_id', 'id']);
            $table->unique(['church_id', 'import_batch_id', 'row_number']);
            $table->index(['church_id', 'import_batch_id', 'status']);
        });
        $db->statement("ALTER TABLE import_rows ADD CHECK (row_number BETWEEN 2 AND 501), ADD CHECK (status IN ('valid', 'invalid', 'duplicate', 'needs_mapping')), ADD CHECK (outcome IS NULL OR outcome IN ('committed', 'excluded', 'duplicate'))");

        foreach (['import_batches', 'import_rows'] as $table) {
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
        $db->unprepared('DROP POLICY IF EXISTS import_rows_tenant ON import_rows; DROP POLICY IF EXISTS import_batches_tenant ON import_batches');
        Schema::connection($this->getConnection())->dropIfExists('import_rows');
        Schema::connection($this->getConnection())->dropIfExists('import_batches');
    }
};
