<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Domain\Sync\ChurchCoordination;
use App\Domain\Sync\CoordinatedChangePublisher;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

/** Explicit guarded fixtures; never loaded by application code. */
final class PublisherScenario
{
    public const SIGNATURE = 'public.append_coordinated_change(uuid,uuid,text,uuid,uuid,character varying,uuid,integer,character varying,jsonb)';

    private static ?string $verifiedSystem = null;

    public static function guard(): void
    {
        if (getenv('PA_ROLE_INITIALIZED') !== 'yes' || ! is_file('/proofs/bootstrap.php')) {
            throw new RuntimeException('Publication fixtures require the guarded disposable runner.');
        }
        $argv = ['fixture', '--probe'];
        ob_start();
        try {
            require '/proofs/bootstrap.php';
        } finally {
            ob_end_clean();
        }
        self::$verifiedSystem = (string) getenv('PA_SYSTEM_ID');
        self::assertConfigured();
    }

    private static function assertConfigured(): void
    {
        if (self::$verifiedSystem === null || self::$verifiedSystem !== getenv('PA_SYSTEM_ID')
            || getenv('PA_ROLE_INITIALIZED') !== 'yes') {
            throw new RuntimeException('Unverified publication fixture target.');
        }
        foreach (['pgsql' => 'PA_RUNTIME', 'pgsql_migration' => 'PA_SETUP'] as $connection => $role) {
            $config = DB::connection($connection)->getConfig();
            if ($config['host'] !== '127.0.0.1' || (string) $config['port'] !== '5432'
                || $config['database'] !== getenv('PA_DATABASE') || $config['username'] !== getenv($role)
                || ! empty($config['url'])) {
                throw new RuntimeException('Publication fixture refuses a foreign Laravel connection.');
            }
        }
    }

    public static function fixture(object $test): array
    {
        self::assertConfigured();
        [, $church] = ChurchScenario::owner();
        [$actor, $member] = ChurchScenario::teacher($church);
        $test->actingAs($actor);
        $request = Request::create('http://localhost/');
        $request->setUserResolver(fn () => $actor);
        $request->setLaravelSession(app('session.store'));
        $ministry = MembershipScenario::ministry($church->id);

        return [$church, $actor, $member, $request, $ministry];
    }

    public static function initialize(string $church, bool $qualified = true): string
    {
        self::assertConfigured();
        $epoch = (string) Str::uuid();
        DB::connection('pgsql_migration')->table('sync_recovery_progress')->insert([
            'church_id' => $church, 'feed_head' => 0, 'baseline_sequence_floor' => 0,
            'coverage_epoch' => $epoch, 'history_baselined_at' => $qualified ? now() : null, 'updated_at' => now(),
        ]);

        return $epoch;
    }

    public static function grantForProof(): void
    {
        self::assertConfigured();
        $role = getenv('PA_RUNTIME');
        if (getenv('PA_ROLE_INITIALIZED') !== 'yes' || ! preg_match('/\Apa_runtime_[a-f0-9]{10}\z/', (string) $role)) {
            throw new RuntimeException('Test activation refuses any non-disposable runtime.');
        }
        DB::connection('pgsql_migration')->statement('GRANT EXECUTE ON FUNCTION '.self::SIGNATURE.' TO "'.$role.'"');
    }

    public static function revokeProof(): void
    {
        self::assertConfigured();
        $role = getenv('PA_RUNTIME');
        if (preg_match('/\Apa_runtime_[a-f0-9]{10}\z/', (string) $role)) {
            DB::connection('pgsql_migration')->statement('REVOKE EXECUTE ON FUNCTION '.self::SIGNATURE.' FROM "'.$role.'"');
        }
    }

    public static function change(string $ministry, string $member): array
    {
        return ['ministry_id' => $ministry, 'target_membership_id' => $member,
            'entity_type' => 'ministry_assignment', 'entity_id' => (string) Str::uuid(),
            'entity_version' => 1, 'action' => 'tombstone', 'payload_json' => ['ministry_id' => $ministry]];
    }

    public static function sql(array $values): int
    {
        return (int) DB::scalar('SELECT public.append_coordinated_change(?::uuid,?::uuid,?::text,?::uuid,?::uuid,?::varchar,?::uuid,?::integer,?::varchar,?::jsonb)', $values);
    }

    public static function values(string $church, string $epoch, array $change): array
    {
        return [$church, $epoch, DB::scalar('SELECT pg_current_xact_id()::text'), $change['ministry_id'], $change['target_membership_id'],
            $change['entity_type'], $change['entity_id'], $change['entity_version'], $change['action'], json_encode($change['payload_json'], JSON_THROW_ON_ERROR)];
    }

    public static function line($pipe): array
    {
        $read = [$pipe];
        $write = $except = [];
        if (stream_select($read, $write, $except, 15) !== 1) {
            throw new RuntimeException('Publisher worker barrier deadline expired.');
        }
        $line = fgets($pipe);
        if (! is_string($line)) {
            throw new RuntimeException('Publisher worker barrier unavailable.');
        }

        return json_decode($line, true, 512, JSON_THROW_ON_ERROR);
    }

    public static function worker(array $input): array
    {
        $process = proc_open(['php', __FILE__], [['pipe', 'r'], ['pipe', 'w'], ['pipe', 'w']], $pipes, base_path());
        if (! is_resource($process)) {
            throw new RuntimeException('Publisher worker unavailable.');
        }
        stream_set_timeout($pipes[1], 15);
        $GLOBALS['publicationWorkers'][] = [$process, $pipes];
        fwrite($pipes[0], json_encode($input, JSON_THROW_ON_ERROR)."\n");
        $first = self::line($pipes[1]);
        expect($first['phase'])->toBe('context');

        return [$process, $pipes, $first];
    }

    public static function blocked(int $holder, int $waiter): void
    {
        $deadline = microtime(true) + 5;
        do {
            $blocked = DB::connection('pgsql_migration')->scalar('SELECT ? = ANY(pg_blocking_pids(?))', [$holder, $waiter]);
            if (microtime(true) > $deadline) {
                throw new RuntimeException('Expected database lock wait was not observed.');
            }
        } while (! $blocked);
    }

    public static function close(array $worker): void
    {
        [$process, $pipes] = $worker;
        fclose($pipes[0]);
        fclose($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[2]);
        expect(proc_close($process))->toBe(0)->and($stderr)->toBe('');
    }

    public static function cleanup(): void
    {
        // A failed initial guard owns no fixtures and must not touch another target.
        if (self::$verifiedSystem === null || self::$verifiedSystem !== getenv('PA_SYSTEM_ID')) {
            return;
        }
        self::assertConfigured();
        while (DB::connection('pgsql_migration')->transactionLevel() > 0) {
            DB::connection('pgsql_migration')->rollBack();
        }
        foreach ($GLOBALS['publicationWorkers'] ?? [] as [$process, $pipes]) {
            foreach ($pipes as $pipe) {
                if (is_resource($pipe)) {
                    fclose($pipe);
                }
            }
            if (is_resource($process)) {
                proc_terminate($process);
                proc_close($process);
            }
        }
        $GLOBALS['publicationWorkers'] = [];
        self::revokeProof();
    }
}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') !== __FILE__) {
    return;
}
if (getenv('PA_ROLE_INITIALIZED') !== 'yes' || getenv('DB_DATABASE') !== getenv('PA_DATABASE') || getenv('DB_USERNAME') !== getenv('PA_RUNTIME')) {
    throw new RuntimeException('Publisher worker refuses uninitialized environment.');
}
$argv = ['worker', '--probe'];
ob_start();
require '/proofs/bootstrap.php';
ob_end_clean();
require '/work/vendor/autoload.php';
$app = require '/work/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$app->instance('request', Request::create('http://localhost/'));
$input = json_decode((string) fgets(STDIN), true, 512, JSON_THROW_ON_ERROR);
$actor = User::findOrFail($input['actor']);
Auth::guard('web')->setUser($actor);
$request = Request::create('http://localhost/');
$request->setUserResolver(fn () => $actor);
$request->setLaravelSession($app->make('session.store'));
if ($input['mfa'] ?? false) {
    $request->session()->put('church_mfa_user_id', $actor->id);
}
try {
    $result = app(TenantContext::class)->run($input['church'], function () use ($input, $request): array {
        $pid = DB::scalar('SELECT pg_backend_pid()');
        echo json_encode(['phase' => 'context', 'pid' => $pid], JSON_THROW_ON_ERROR)."\n";
        if (trim((string) fgets(STDIN)) !== 'enter') {
            throw new RuntimeException('Missing entry barrier.');
        }
        if ($input['timeout'] ?? false) {
            DB::statement("SET LOCAL lock_timeout='300ms'");
        }
        DB::statement("SET LOCAL statement_timeout='10s'");

        return app(ChurchCoordination::class)->run($request, function ($member, $freshActor, $context) use ($input, $pid): array {
            $sequence = null;
            if ($input['publish'] ?? true) {
                $sequence = app(CoordinatedChangePublisher::class)->append($context, $input['epoch'], $input['change']);
            }
            echo json_encode(['phase' => 'published', 'pid' => $pid, 'sequence' => $sequence,
                'role' => $member->role->value, 'freshVerified' => $freshActor->hasVerifiedEmail()], JSON_THROW_ON_ERROR)."\n";
            if (trim((string) fgets(STDIN)) !== 'commit') {
                throw new RuntimeException('Deliberate outer rollback.');
            }
            if ($input['lockActor'] ?? false) {
                DB::table('users')->where('id', $input['actor'])->lockForUpdate()->first();
            }

            return ['phase' => 'committed', 'sequence' => $sequence];
        });
    });
    echo json_encode($result, JSON_THROW_ON_ERROR)."\n";
} catch (Throwable $error) {
    echo json_encode(['phase' => 'refused', 'type' => get_class($error), 'code' => (string) $error->getCode()], JSON_THROW_ON_ERROR)."\n";
}
