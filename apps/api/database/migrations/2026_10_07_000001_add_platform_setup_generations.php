<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection($this->getConnection())->table('platform_admins', function (Blueprint $table): void {
            $table->unsignedBigInteger('setup_generation')->default(1);
            $table->timestamp('setup_redeemed_at')->nullable();
            $table->timestamp('setup_issued_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::connection($this->getConnection())->table('platform_admins', function (Blueprint $table): void {
            $table->dropColumn(['setup_generation', 'setup_redeemed_at', 'setup_issued_at']);
        });
    }
};
