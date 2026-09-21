<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $role = config('database.runtime_role');
        if (! is_string($role) || preg_match('/\A[a-z_][a-z0-9_]*\z/', $role) !== 1) {
            throw new RuntimeException('Invalid runtime role.');
        }
        DB::connection($this->getConnection())->unprepared('GRANT SELECT, INSERT, UPDATE, DELETE ON password_reset_tokens, sessions, jobs, job_batches, failed_jobs, cache, cache_locks TO "'.$role.'"; GRANT USAGE, SELECT ON SEQUENCE jobs_id_seq, failed_jobs_id_seq TO "'.$role.'"');
    }

    public function down(): void {}
};
