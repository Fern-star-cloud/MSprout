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

        $schema->create('platform_admins', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('handle', 64)->unique();
            $table->string('recovery_email', 254)->unique();
            $table->string('password')->nullable();
            $table->string('status', 32)->default('pending');
            $table->timestamp('email_verified_at')->nullable();
            $table->text('two_factor_secret')->nullable();
            $table->text('two_factor_recovery_codes')->nullable();
            $table->timestamp('two_factor_confirmed_at')->nullable();
            $table->timestamp('recovery_codes_acknowledged_at')->nullable();
            $table->timestamp('setup_expires_at')->nullable();
            $table->timestamp('last_authenticated_at')->nullable();
            $table->rememberToken();
            $table->timestamps();
        });

        $connection = DB::connection($this->getConnection());
        $connection->statement(<<<'SQL'
            ALTER TABLE platform_admins
            ADD CONSTRAINT platform_admins_status_check
            CHECK (status IN ('pending', 'active', 'disabled'))
            SQL);

        $runtimeRole = config('database.runtime_role');

        if (! is_string($runtimeRole) || preg_match('/\A[a-z_][a-z0-9_]*\z/', $runtimeRole) !== 1) {
            throw new RuntimeException('DB_RUNTIME_USERNAME must be a safe PostgreSQL role identifier.');
        }

        $quotedRuntimeRole = '"'.str_replace('"', '""', $runtimeRole).'"';
        $connection->unprepared(<<<SQL
            REVOKE ALL ON TABLE platform_admins FROM PUBLIC;
            REVOKE ALL ON TABLE platform_admins FROM {$quotedRuntimeRole};
            GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE platform_admins TO {$quotedRuntimeRole};
            SQL);
    }

    public function down(): void
    {
        Schema::connection($this->getConnection())->dropIfExists('platform_admins');
    }
};
