<?php

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;
use Tests\Support\MembershipScenario;
use Tests\Support\PostgresTestDatabase;

it('serializes concurrent retries so one batch creates students and audit evidence once', function () {
    PostgresTestDatabase::refresh();
    [$owner, $church] = MembershipScenario::owner($this);
    $file = UploadedFile::fake()->createWithContent(
        'students.csv',
        "first_name,last_name,birthdate,gender,ministries,external_reference\nAri,Sprout,2018-08-20,,,concurrent-1",
    );
    $preview = $this->post('/api/imports/students/preview', ['file' => $file], ['Accept' => 'application/json'])->assertOk();
    $batch = $preview->json('id');
    $row = $preview->json('rows.0.id');
    $commitKey = (string) Str::uuid();
    $admin = DB::connection('pgsql_migration');
    $workers = [];
    $labels = [];
    $admin->beginTransaction();
    $admin->table('import_batches')->where('id', $batch)->lockForUpdate()->first();
    try {
        foreach (range(1, 2) as $attempt) {
            $label = 'import-test-'.Str::uuid();
            $labels[] = $label;
            $process = new Process([PHP_BINARY, '-d', 'extension=gd', base_path('tests/Support/import-worker.php')], base_path(), ['APP_ENV' => 'testing']);
            // Dynamic database credentials go over stdin, never command-line arguments, files, or diagnostic output.
            $process->setInput(json_encode([
                'connection' => config('database.connections.pgsql'), 'key' => config('app.key'),
                'label' => $label, 'user_id' => $owner->id, 'church_id' => $church->id,
                'batch_id' => $batch, 'row_ids' => [$row], 'commit_key' => $commitKey,
                'correlation_id' => (string) Str::uuid(), 'attempt' => $attempt,
            ], JSON_THROW_ON_ERROR));
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
            $lines = preg_split('/\R/', trim($worker->getOutput()));
            $results[] = end($lines);
        }
        expect($results)->toBe(['completed:1', 'completed:1'])
            ->and($admin->table('students')->where('church_id', $church->id)->where('external_reference', 'concurrent-1')->count())->toBe(1)
            ->and($admin->table('audit_events')->where('target_id', $batch)->where('action', 'student_import.completed')->count())->toBe(1);
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
});
