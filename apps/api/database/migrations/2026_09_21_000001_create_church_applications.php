<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $schema = Schema::connection($this->getConnection());
        // Applications and their decision audits are platform records, not tenant data.
        $schema->create('church_applications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status', 16)->default('pending');
            $table->string('church_name', 160)->nullable();
            $table->string('timezone', 100)->nullable();
            $table->string('city', 120)->nullable();
            $table->string('address', 240)->nullable();
            $table->string('duplicate_key', 64)->nullable();
            $table->uuid('church_id')->nullable()->unique();
            $table->string('category', 32)->nullable();
            $table->string('reason', 500)->nullable();
            $table->uuid('decided_by')->nullable();
            $table->timestampTz('decided_at')->nullable();
            $table->uuid('correlation_id')->nullable();
            $table->timestampTz('purged_at')->nullable();
            $table->timestampsTz();
            $table->index(['status', 'decided_at']);
        });
        $schema->create('platform_application_audits', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('application_id');
            $table->unsignedBigInteger('applicant_id');
            $table->uuid('actor_id');
            $table->string('action', 32);
            $table->string('category', 32)->nullable();
            $table->uuid('correlation_id');
            $table->timestampTz('occurred_at');
            $table->unique('application_id');
        });
        // Retention must never cascade-delete memberships hidden by RLS.
        $schema->table('church_memberships', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->foreign('user_id')->references('id')->on('users')->restrictOnDelete();
        });
        $role = config('database.runtime_role');
        if (! is_string($role) || preg_match('/\A[a-z_][a-z0-9_]*\z/', $role) !== 1) {
            throw new RuntimeException('Invalid runtime role.');
        }
        $connection = DB::connection($this->getConnection());
        $connection->unprepared(<<<SQL
            ALTER TABLE church_applications ADD CONSTRAINT church_application_status CHECK (status IN ('pending', 'approved', 'rejected'));
            CREATE UNIQUE INDEX applications_active_user ON church_applications (user_id) WHERE status IN ('pending', 'approved');
            CREATE UNIQUE INDEX applications_active_identity ON church_applications (duplicate_key) WHERE status IN ('pending', 'approved');
            REVOKE ALL ON church_applications, platform_application_audits FROM PUBLIC;
            GRANT SELECT, INSERT, UPDATE ON church_applications TO "{$role}";
            GRANT SELECT, INSERT ON platform_application_audits TO "{$role}";
            REVOKE UPDATE, DELETE, TRUNCATE ON platform_application_audits FROM "{$role}";
            SQL);
    }

    public function down(): void
    {
        $schema = Schema::connection($this->getConnection());
        $schema->dropIfExists('platform_application_audits');
        $schema->dropIfExists('church_applications');
        $schema->table('church_memberships', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }
};
