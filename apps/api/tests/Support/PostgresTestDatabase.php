<?php

namespace Tests\Support;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use RuntimeException;

final class PostgresTestDatabase
{
    private static bool $migrated = false;

    public static function refresh(): void
    {
        if (! self::$migrated) {
            $exitCode = Artisan::call('migrate:fresh', [
                '--database' => 'pgsql_migration',
                '--force' => true,
            ]);

            if ($exitCode !== 0) {
                throw new RuntimeException('Unable to migrate the PostgreSQL test database.');
            }

            self::$migrated = true;
        } else {
            self::truncateApplicationTables();
        }

        DB::purge('pgsql');
        DB::reconnect('pgsql');
    }

    private static function truncateApplicationTables(): void
    {
        $connection = DB::connection('pgsql_migration');
        $tables = $connection->select(<<<'SQL'
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = current_schema()
              AND tablename <> 'migrations'
            ORDER BY tablename
            SQL);

        if ($tables === []) {
            return;
        }

        $quotedTables = array_map(
            static fn (object $row): string => '"'.str_replace('"', '""', $row->tablename).'"',
            $tables,
        );

        $connection->unprepared('TRUNCATE TABLE '.implode(', ', $quotedTables).' RESTART IDENTITY CASCADE');
    }
}
