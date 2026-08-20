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

        $schema->create('church_memberships', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('church_id')->constrained('churches')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('role', 32);
            $table->string('status', 32)->default('active');
            $table->timestamps();
            $table->unique(['church_id', 'user_id']);
            $table->index(['user_id', 'status']);
        });

        $connection = DB::connection($this->getConnection());
        $connection->statement(<<<'SQL'
            ALTER TABLE church_memberships
            ADD CONSTRAINT church_memberships_role_check
            CHECK (role IN ('owner', 'teacher'))
            SQL);
        $connection->statement(<<<'SQL'
            CREATE UNIQUE INDEX church_memberships_one_active_owner
            ON church_memberships (church_id)
            WHERE role = 'owner' AND status = 'active'
            SQL);
    }

    public function down(): void
    {
        Schema::connection($this->getConnection())->dropIfExists('church_memberships');
    }
};
