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

        $schema->create('churches', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name', 160);
            $table->string('slug', 100)->unique();
            $table->string('timezone', 100)->default('Asia/Manila');
            $table->string('status', 32)->default('active');
            $table->timestamps();
        });

        DB::connection($this->getConnection())->statement(<<<'SQL'
            ALTER TABLE churches
            ADD CONSTRAINT churches_status_check
            CHECK (status IN ('active', 'suspended'))
            SQL);
    }

    public function down(): void
    {
        Schema::connection($this->getConnection())->dropIfExists('churches');
    }
};
