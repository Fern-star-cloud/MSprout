<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PragmaRX\Google2FA\Google2FA;
use Symfony\Component\Process\Process;
use Tests\Support\ChurchScenario;
use Tests\Support\MembershipScenario;
use Tests\Support\PostgresTestDatabase;

it('serializes two simultaneous transfers and denies the stale Owner after the lock is released', function () {
    PostgresTestDatabase::refresh();
    [$owner, $church] = MembershipScenario::owner($this);
    [, $first] = ChurchScenario::teacher($church);
    [, $second] = ChurchScenario::teacher($church);
    $admin = DB::connection('pgsql_migration');
    $workers = [];
    $labels = [];
    $admin->beginTransaction();
    $admin->table('churches')->where('id', $church->id)->lockForUpdate()->first();
    try {
        foreach ([$first, $second] as $target) {
            $label = 'transfer-test-'.Str::uuid();
            $labels[] = $label;
            $process = new Process([PHP_BINARY, base_path('tests/Support/transfer-worker.php')], base_path(), ['APP_ENV' => 'testing']);
            // Credentials go over stdin, never command-line arguments, files or diagnostic output.
            $process->setInput(json_encode([
                'connection' => config('database.connections.pgsql'), 'key' => config('app.key'),
                'label' => $label, 'user_id' => $owner->id, 'church_id' => $church->id,
                'target_id' => $target->id, 'password' => $this->password,
                'code' => (new Google2FA)->getCurrentOtp($this->secret),
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
        expect($waiting, implode(', ', array_map(fn ($worker) => $worker->getOutput(), $workers)))->toBe(2);
        $admin->commit();
        $results = [];
        foreach ($workers as $worker) {
            $worker->wait();
            $results[] = $worker->getOutput();
        }
        sort($results);
        expect($results)->toBe(['denied', 'transferred']);
        expect($admin->table('church_memberships')->where('church_id', $church->id)->where('role', 'owner')->where('status', 'active')->count())->toBe(1);
        expect($admin->table('membership_audits')->where('action', 'ownership.transferred')->count())->toBe(1);
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
