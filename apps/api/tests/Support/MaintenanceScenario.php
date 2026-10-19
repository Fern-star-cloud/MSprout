<?php

namespace Tests\Support;

use Closure;
use Illuminate\Support\Facades\DB;
use LogicException;

/** Test driver only: authenticate a separate fixture role, never SET ROLE. */
final class MaintenanceScenario
{
    public static function run(Closure $operation): mixed
    {
        $role = getenv('DB_TEST_MAINTENANCE_USERNAME');
        $password = getenv('DB_TEST_MAINTENANCE_PASSWORD');
        if (! $role || ! $password || $role === config('database.runtime_role')
            || config('database.connections.pgsql.database') !== getenv('DB_TEST_DATABASE')
            || DB::transactionLevel() !== 0) {
            throw new LogicException('Independent test maintenance identity unavailable.');
        }
        $previous = DB::getDefaultConnection();
        $mode = config('maintenance.process');
        config(['database.connections.maintenance_test' => array_replace(config('database.connections.pgsql'), ['username' => $role, 'password' => $password]), 'maintenance.process' => true]);
        DB::purge('maintenance_test');
        DB::setDefaultConnection('maintenance_test');
        try {
            return $operation();
        } finally {
            DB::purge('maintenance_test');
            DB::setDefaultConnection($previous);
            config(['maintenance.process' => $mode, 'database.connections.maintenance_test' => null]);
        }
    }
}
