<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $role = config('database.runtime_role');
        if (! is_string($role) || ! preg_match('/\A[a-z_][a-z0-9_]*\z/', $role)) {
            throw new RuntimeException('Invalid runtime role.');
        }
        $db = DB::connection($this->getConnection());
        $db->unprepared(str_replace('__RUNTIME_ROLE__', $role, file_get_contents(database_path('sql/coordinated-publication.sql'))));
        $db->unprepared(str_replace('__RUNTIME_ROLE__', $role, file_get_contents(database_path('sql/coordinated-maintenance.sql'))));
        // Construction only: activation is owner-only and requires separately committed admission seals.
    }

    public function down(): void
    {
        throw new RuntimeException('Publication rollback requires a separately reviewed drainage and recovery plan.');
    }
};
