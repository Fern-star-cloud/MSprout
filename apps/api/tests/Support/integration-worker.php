<?php

declare(strict_types=1);

use App\Domain\Attendance\PublishAttendanceChange;
use App\Domain\Audit\AuditEntry;
use App\Domain\Audit\AuditWriter;
use App\Domain\Sync\ChurchCoordination;
use App\Domain\Sync\TrustedSystemCoordination;
use App\Domain\Sync\TrustedSystemPurpose;
use App\Models\AttendanceSession;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Tests\Support\IntegrationScenario as I;

$argv = ['worker', '--probe'];
ob_start();
require '/proofs/bootstrap.php';
ob_end_clean();
require '/work/vendor/autoload.php';
$app = require '/work/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

function integrationEmit(array $message): void
{
    echo json_encode($message, JSON_THROW_ON_ERROR)."\n";
}
function integrationCommand(): string
{
    $line = fgets(STDIN);

    return $line === false ? 'rollback' : (json_decode($line, true, 512, JSON_THROW_ON_ERROR)['command'] ?? 'rollback');
}

try {
    I::guard();
    $input = json_decode(fgets(STDIN), true, 512, JSON_THROW_ON_ERROR);
    config(['synchronization.coordinated_publication' => ($input['mode'] ?? '') !== 'legacy']);
    if ($input['mode'] === 'inverted_progress') {
        DB::setDefaultConnection('pgsql_migration');
    }
    $request = Request::create('http://localhost/');
    app()->instance('request', $request);
    if (isset($input['actor'])) {
        config(['session.driver' => 'database', 'session.connection' => 'pgsql']);
        app('session')->forgetDrivers();
        app()->forgetInstance('session.store');
        $store = app('session.store');
        $store->setId($input['session']);
        $store->start();
        $request->setLaravelSession($store);
        $actor = User::findOrFail($input['actor']);
        Auth::guard('web')->setUser($actor);
        $request->setUserResolver(fn () => $actor);
    }
    if ($input['mode'] === 'system') {
        config(['database.connections.maintenance_worker' => array_replace(config('database.connections.pgsql'), ['username' => getenv('DB_TEST_MAINTENANCE_USERNAME'), 'password' => getenv('DB_TEST_MAINTENANCE_PASSWORD')]), 'maintenance.process' => true]);
        DB::setDefaultConnection('maintenance_worker');
    }
    integrationEmit(['ready' => true, 'pid' => (int) DB::scalar('SELECT pg_backend_pid()')]);
    if ($input['mode'] === 'cache') {
        integrationEmit(['cached' => (string) DB::scalar("SELECT nextval('public.change_feed_sequence_seq')")]);
        while (integrationCommand() === 'next') {
            integrationEmit(['cached' => (string) DB::scalar("SELECT nextval('public.change_feed_sequence_seq')")]);
        }
        integrationEmit(['closed' => true]);
        exit;
    }
    if ($input['mode'] === 'inverted_progress') {
        // Adversarial test-only migration-role inversion; never an application caller.
        DB::transaction(function () use ($input): void {
            DB::table('sync_recovery_progress')->where('church_id', $input['church'])->lockForUpdate()->first();
            integrationEmit(['inside' => true]);
            if (integrationCommand() !== 'go') {
                throw new RuntimeException('isolated rollback');
            }
            DB::table('churches')->where('id', $input['church'])->lockForUpdate()->first();
        });
        integrationEmit(['committed' => true]);
        exit;
    }
    $operation = function () use ($input): void {
        integrationEmit(['inside' => true]);
        if (integrationCommand() !== 'go') {
            throw new RuntimeException('isolated rollback');
        }
        $session = AttendanceSession::query()->where('church_id', $input['church'])->lockForUpdate()->findOrFail($input['attendance']);
        $session->forceFill(['version' => $session->version + 1])->save();
        app(PublishAttendanceChange::class)->handle($session);
        integrationEmit(['published' => true, 'sequence' => (string) DB::table('change_feed')->where('church_id', $input['church'])->max('sequence')]);
        if (integrationCommand() !== 'commit') {
            throw new RuntimeException('isolated rollback');
        }
    };
    if ($input['mode'] === 'system') {
        app(TrustedSystemCoordination::class)->run($input['church'], TrustedSystemPurpose::RetentionCleanup, function () use ($input): void {
            integrationEmit(['inside' => true]);
            if (integrationCommand() !== 'go') {
                throw new RuntimeException('isolated rollback');
            }
            $counts = DB::scalar('SELECT public.prune_church_operational_data(?,?,?,?)', [$input['church'], now()->subDays(180), now()->subDays(180), now()->subDays(90)]);
            app(AuditWriter::class)->record(new AuditEntry('church', 'operations.retention.pruned', 'system', null, 'system', null, 'success', $input['church'], metadata: ['count' => array_sum(json_decode($counts, true))]));
            integrationEmit(['maintained' => true]);
            if (integrationCommand() !== 'commit') {
                throw new RuntimeException('isolated rollback');
            }
        });
    } elseif ($input['mode'] === 'legacy') {
        app(TenantContext::class)->run($input['church'], $operation);
    } else {
        app(TenantContext::class)->run($input['church'], fn () => app(ChurchCoordination::class)->run($request, $operation));
    }
    integrationEmit(['committed' => true]);
} catch (Throwable $error) {
    integrationEmit(['rolled_back' => true, 'error' => get_class($error), 'sqlstate' => $error instanceof QueryException ? ($error->errorInfo[0] ?? null) : null]);
}
