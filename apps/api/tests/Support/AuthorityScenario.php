<?php

namespace Tests\Support;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/** Independently guarded C fixtures; never loaded by production bootstrap. */
final class AuthorityScenario
{
    private static array $workers = [];

    public static function fixture($test): array
    {
        self::guard();
        [, $church] = ChurchScenario::owner();
        [$actor, $member] = ChurchScenario::teacher($church);
        $actor = User::findOrFail($actor->id);
        PersistedChurchSession::authenticate($test, $actor);
        $request = Request::create('http://localhost/');
        $request->setLaravelSession(app('session.store'));
        $request->setUserResolver(fn () => $actor);

        return [$church, $actor, $member, $request];
    }

    public static function worker(array $input): array
    {
        self::guard();
        if (! isset($input['mode'])) {
            $input['mode'] = 'coordinate';
            $input['session'] = DB::table('sessions')->where('user_id', $input['actor'])->value('id');
        }
        $process = proc_open([PHP_BINARY, base_path('tests/Support/authority-worker.php')], [['pipe', 'r'], ['pipe', 'w'], ['pipe', 'w']], $pipes, base_path());
        if (! is_resource($process)) {
            throw new RuntimeException('Authority worker unavailable.');
        }
        fwrite($pipes[0], json_encode($input, JSON_THROW_ON_ERROR)."\n");

        $worker = [$process, $pipes, self::line($pipes[1])];
        self::$workers[] = $worker;

        return $worker;
    }

    public static function line($stream): array
    {
        $read = [$stream];
        $write = $except = [];
        if (stream_select($read, $write, $except, 25) !== 1 || ($line = fgets($stream)) === false) {
            throw new RuntimeException('Authority IPC barrier failed.');
        }

        return json_decode($line, true, 512, JSON_THROW_ON_ERROR);
    }

    public static function blocked(int $blocker, int $waiter): void
    {
        $until = microtime(true) + 4;
        do {
            if (DB::connection('pgsql_migration')->scalar('SELECT ? = ANY(pg_blocking_pids(?))', [$blocker, $waiter])) {
                return;
            }
            usleep(10_000);
        } while (microtime(true) < $until);
        throw new RuntimeException('Expected database-observed authority wait absent.');
    }

    public static function close(array $worker): void
    {
        if (! is_resource($worker[0])) {
            return;
        }
        fclose($worker[1][0]);
        fclose($worker[1][1]);
        $errors = stream_get_contents($worker[1][2]);
        fclose($worker[1][2]);
        if ($errors !== '') {
            file_put_contents('/evidence/worker-error-'.bin2hex(random_bytes(5)).'.log', $errors);
        }
        if (proc_close($worker[0]) !== 0) {
            throw new RuntimeException('Authority worker failed.');
        }
    }

    public static function cleanup(): void
    {
        foreach (self::$workers as $worker) {
            self::close($worker);
        }
        self::$workers = [];
    }

    public static function guard(): void
    {
        if (getenv('PC_ROLE_INITIALIZED') !== 'yes' || ! is_file('/proofs/bootstrap.php')) {
            throw new RuntimeException('Authority fixtures require the independent C runner.');
        }
        $argv = ['fixture', '--probe'];
        ob_start();
        try {
            require '/proofs/bootstrap.php';
        } finally {
            ob_end_clean();
        }
        foreach (['pgsql' => 'PC_RUNTIME', 'pgsql_migration' => 'PC_SETUP'] as $name => $role) {
            $config = DB::connection($name)->getConfig();
            if ($config['host'] !== '127.0.0.1' || (string) $config['port'] !== '5432'
                || $config['database'] !== getenv('PC_DATABASE') || $config['username'] !== getenv($role)
                || ! empty($config['url'])) {
                throw new RuntimeException('Authority fixture refuses foreign connection configuration.');
            }
        }
    }
}
