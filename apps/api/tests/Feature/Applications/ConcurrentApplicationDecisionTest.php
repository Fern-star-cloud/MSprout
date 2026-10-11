<?php

use App\Models\ChurchApplication;
use App\Models\PlatformAdmin;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;
use Tests\Support\PostgresTestDatabase;

it('serializes concurrent application decisions without duplicate provisioning audit or delivery', function (array $decisions) {
    PostgresTestDatabase::refresh();
    $application = ChurchApplication::create(['user_id' => User::factory()->create()->id, 'church_name' => 'Synthetic concurrency church', 'city' => 'Synthetic city', 'timezone' => 'Asia/Manila', 'status' => 'pending', 'submitted_at' => now()]);
    $actor = PlatformAdmin::factory()->active()->create(['handle' => 'sage.dev']);
    $admin = DB::connection('pgsql_migration');
    $workers = [];
    $labels = [];
    $admin->beginTransaction();
    $admin->table('church_applications')->where('id', $application->id)->lockForUpdate()->first();
    try {
        foreach ($decisions as $decision) {
            $label = 'application-test-'.Str::uuid();
            $labels[] = $label;
            $process = new Process([PHP_BINARY, base_path('tests/Support/application-decision-worker.php')], base_path(), ['APP_ENV' => 'testing']);
            // Credentials travel through stdin, never arguments, files or diagnostic output.
            $process->setInput(json_encode(['connection' => config('database.connections.pgsql'), 'key' => config('app.key'), 'label' => $label, 'application_id' => $application->id, 'actor_id' => $actor->id, 'correlation_id' => (string) Str::uuid(), 'decision' => $decision], JSON_THROW_ON_ERROR));
            $process->setTimeout(30)->start();
            $workers[] = $process;
        }
        $deadline = microtime(true) + 15;
        do {
            $admin->select('SELECT pg_stat_clear_snapshot()');
            $waiting = $admin->table('pg_stat_activity')->whereIn('application_name', $labels)->where('wait_event_type', 'Lock')->count();
            if ($waiting === 2) {
                break;
            }
            usleep(50000);
        } while (microtime(true) < $deadline);
        expect($waiting)->toBe(2);
        $admin->commit();
        $results = [];
        foreach ($workers as $worker) {
            $worker->wait();
            expect($worker->getExitCode())->toBe(0);
            $results[] = trim($worker->getOutput());
        }
        $state = $application->fresh()->status->value;
        expect($state)->toBeIn(['approved', 'rejected']);
        sort($results);
        $expected = $decisions[0] === $decisions[1] ? [$state, $state] : [$state, 'stale'];
        sort($expected);
        expect($results)->toBe($expected)
            ->and($admin->table('churches')->count())->toBe($state === 'approved' ? 1 : 0)
            ->and($admin->table('church_memberships')->where('role', 'owner')->where('status', 'active')->count())->toBe($state === 'approved' ? 1 : 0)
            ->and($admin->table('audit_events')->where('target_id', $application->id)->count())->toBe(1)
            ->and($admin->table('jobs')->count())->toBe(1);
    } finally {
        if ($admin->transactionLevel() > 0) {
            $admin->rollBack();
        }
        foreach ($workers as $worker) {
            if ($worker->isRunning()) {
                $worker->stop();
            }
        }
    }
})->with([
    'two approvals' => [['approve', 'approve']],
    'two rejections' => [['reject', 'reject']],
    'opposing decisions' => [['approve', 'reject']],
]);
