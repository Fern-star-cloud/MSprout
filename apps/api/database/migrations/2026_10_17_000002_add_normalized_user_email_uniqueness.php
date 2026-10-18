<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $db = DB::connection($this->getConnection());
        $collisions = $db->scalar('SELECT count(*) FROM (SELECT lower(btrim(email)) FROM public.users GROUP BY lower(btrim(email)) HAVING count(*) > 1) AS collisions');
        if ((int) $collisions !== 0) {
            throw new RuntimeException('Normalized email collisions require separate identity resolution; no accounts were changed.');
        }
        $db->statement('CREATE UNIQUE INDEX users_normalized_email_unique ON public.users (lower(btrim(email)))');
    }

    public function down(): void
    {
        DB::connection($this->getConnection())->statement('DROP INDEX IF EXISTS public.users_normalized_email_unique');
    }
};
