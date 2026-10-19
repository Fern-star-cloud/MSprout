<?php

declare(strict_types=1);

use App\Domain\Sync\MaintenanceCoordinator;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Contracts\Http\Kernel as HttpKernel;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

require '/work/vendor/autoload.php';
$app = require '/work/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$mode = $argv[1] ?? '';
if ($mode !== 'web' && $mode !== 'maintenance') {
    throw new RuntimeException('Explicit process probe required.');
}
$role = DB::selectOne('SELECT current_user AS actor,session_user AS authenticated,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user');
if ($role->rolsuper || $role->rolbypassrls || $role->actor !== $role->authenticated) {
    throw new RuntimeException('Unexpected process authority.');
}
if ($mode === 'web') {
    if (is_readable('/run/secrets/msprout-maintenance-password') || getenv('DB_TEST_MAINTENANCE_PASSWORD')
        || getenv('DB_MIGRATION_PASSWORD') || getenv('DB_MAINTENANCE_PASSWORD')
        || $role->actor !== config('database.runtime_role')) {
        throw new RuntimeException('Web process received privileged credentials.');
    }
    $denied = 0;
    foreach (['SELECT public.maintenance_church_ids()', 'SELECT public.protected_user_has_memberships(1)', 'SET ROLE "'.config('maintenance.role').'"', 'SELECT rolpassword FROM pg_authid'] as $sql) {
        try {
            DB::select($sql);
        } catch (QueryException $error) {
            if (($error->errorInfo[0] ?? '') === '42501') {
                $denied++;
            }
        }
    }
    if ($denied !== 4 || $app->make(HttpKernel::class)->handle(Request::create('/health/live'))->getStatusCode() !== 200) {
        throw new RuntimeException('Ordinary web process isolation failed.');
    }
    echo json_encode(['webRoleRestricted' => true, 'credentialFileAbsent' => true, 'privilegedEnvironmentAbsent' => true, 'denials' => $denied, 'httpStatus' => 200], JSON_THROW_ON_ERROR);
} else {
    app(MaintenanceCoordinator::class)->assertWorker();
    Artisan::call('list');
    $events = app(Schedule::class)->events();
    if (config('cache.default') !== 'file' || count($events) !== 2 || ! $events[0]->withoutOverlapping || ! $events[1]->withoutOverlapping) {
        throw new RuntimeException('Private maintenance scheduler isolation failed.');
    }
    echo json_encode(['independentAuthentication' => true, 'workerVerified' => true, 'privateFileCache' => true, 'overlapProtectedSchedules' => count($events), 'httpStatus' => $app->make(HttpKernel::class)->handle(Request::create('/health/live'))->getStatusCode()], JSON_THROW_ON_ERROR);
}
