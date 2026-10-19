<?php

namespace Tests\Support;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

final class IntegrationScenario
{
    public const APPEND = 'public.append_coordinated_change(uuid,uuid,text,uuid,uuid,character varying,uuid,integer,character varying,jsonb)';

    public static function guard(): void
    {
        AuthorityScenario::guard();
        if (getenv('PDE_ISOLATED') !== 'yes') {
            throw new RuntimeException('BDE operations require the independently identified integration runner.');
        }
    }

    private static array $workers = [];

    public static function worker(array $input): array
    {
        self::guard();
        $process = proc_open([PHP_BINARY, base_path('tests/Support/integration-worker.php')], [['pipe', 'r'], ['pipe', 'w'], ['pipe', 'w']], $pipes, base_path());
        if (! is_resource($process)) {
            throw new RuntimeException('Integration worker unavailable.');
        }
        fwrite($pipes[0], json_encode($input, JSON_THROW_ON_ERROR)."\n");
        $worker = [$process, $pipes, AuthorityScenario::line($pipes[1])];
        self::$workers[] = $worker;

        return $worker;
    }

    public static function send(array $worker, string $command): void
    {
        fwrite($worker[1][0], json_encode(['command' => $command], JSON_THROW_ON_ERROR)."\n");
    }

    public static function cleanup(): void
    {
        foreach (self::$workers as $worker) {
            if (is_resource($worker[0])) {
                fclose($worker[1][0]);
                fclose($worker[1][1]);
                $error = stream_get_contents($worker[1][2]);
                fclose($worker[1][2]);
                if ($error !== '') {
                    file_put_contents('/evidence/integration-worker-error-'.bin2hex(random_bytes(5)).'.log', $error);
                }
                proc_close($worker[0]);
            }
        }
        self::$workers = [];
    }

    public static function ownerFixture(object $test): array
    {
        self::guard();
        [$actor, $church, $member] = MembershipScenario::owner($test);
        $request = Request::create('http://localhost/');
        $request->setLaravelSession(app('session.store'));
        $request->setUserResolver(fn () => $actor);

        return [$church, $actor, $member, $request, MembershipScenario::ministry($church->id)];
    }

    public static function seal(): void
    {
        self::guard();
        $db = self::control();
        $db->exec('ALTER DATABASE "'.getenv('PC_DATABASE').'" ALLOW_CONNECTIONS false');
        $db->exec('ALTER ROLE "'.getenv('PC_RUNTIME').'" NOLOGIN');
    }

    public static function prepareCutover(): void
    {
        self::guard();
        // Retain the target owner connection before closing database admission.
        // A fresh browser kernel has not necessarily opened it yet.
        DB::connection('pgsql_migration')->getPdo();
        try {
            self::seal();
            DB::connection('pgsql_migration')->statement('SELECT public.record_publication_admission_seal()');
            self::rotateRuntimeCredential();
        } catch (\Throwable $error) {
            self::reopen();
            throw $error;
        }
    }

    public static function activate(): array
    {
        self::guard();
        $oldPid = DB::connection('pgsql')->scalar('SELECT pg_backend_pid()');
        self::prepareCutover();
        DB::disconnect('pgsql');
        $until = microtime(true) + 4;
        while (DB::connection('pgsql_migration')->scalar('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=?)', [$oldPid])) {
            if (microtime(true) >= $until) {
                throw new RuntimeException('Owned runtime connection did not drain.');
            }
            usleep(10000);
        }
        // Each prior PHPUnit application may retain an idle PDO in an exception trace.
        // Explicitly drain only this verified disposable database's idle fixture backends;
        // an active transaction is never cancelled or ignored by this positive fixture.
        $admin = DB::connection('pgsql_migration');
        $ownPid = $admin->scalar('SELECT pg_backend_pid()');
        $drained = [];
        foreach ($admin->select('SELECT pid,usename,state FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()') as $old) {
            if ($old->state !== 'idle' || ! in_array($old->usename, [getenv('PC_RUNTIME'), getenv('PC_SETUP')], true)) {
                continue;
            }
            $drained[] = $old->pid;
            $admin->select('SELECT pg_terminate_backend(?)', [$old->pid]);
        }
        $until = microtime(true) + 4;
        while ($admin->scalar("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=ANY(?::int[]) OR (datname=current_database() AND backend_type<>'client backend'))", ['{'.implode(',', $drained).'}'])) {
            if (microtime(true) >= $until) {
                throw new RuntimeException('Disposable fixture or background backends did not exit.');
            }
            usleep(10000);
        }
        file_put_contents('/evidence/drained-fixture-backends-'.bin2hex(random_bytes(5)).'.json', json_encode(['operatorPid' => $ownPid, 'drainedIdleFixturePids' => $drained], JSON_THROW_ON_ERROR));
        try {
            $raw = DB::connection('pgsql_migration')->transaction(fn () => DB::connection('pgsql_migration')->scalar('SELECT public.activate_coordinated_publication(?::uuid)', [(string) Str::uuid()]));
        } catch (\Throwable $error) {
            file_put_contents('/evidence/drain-diagnostic.json', json_encode(DB::connection('pgsql_migration')->select('SELECT pid,usename,backend_type,state FROM pg_stat_activity WHERE datname=current_database()'), JSON_THROW_ON_ERROR));
            throw $error;
        } finally {
            self::reopen();
        }
        config(['synchronization.coordinated_publication' => true]);

        return json_decode($raw, true, flags: JSON_THROW_ON_ERROR);
    }

    public static function reopen(): void
    {
        // Existing owner connection only; the database seal deliberately blocks new connections.
        $db = self::control();
        $db->exec('ALTER DATABASE "'.getenv('PC_DATABASE').'" ALLOW_CONNECTIONS true');
        $db->exec('ALTER ROLE "'.getenv('PC_RUNTIME').'" LOGIN');
    }

    private static function rotateRuntimeCredential(): void
    {
        $password = bin2hex(random_bytes(32));
        $control = self::control();
        try {
            $control->exec('ALTER ROLE "'.getenv('PC_RUNTIME').'" PASSWORD '.$control->quote($password));
        } catch (\PDOException) {
            throw new RuntimeException('Isolated runtime credential rotation failed.');
        }
        config(['database.connections.pgsql.password' => $password]);
        putenv('DB_PASSWORD='.$password);
        $_ENV['DB_PASSWORD'] = $_SERVER['DB_PASSWORD'] = $password;
    }

    private static function control(): \PDO
    {
        if (getenv('PDE_ISOLATED') !== 'yes' || ! preg_match('/\Apc_[a-f0-9]{10}_test\z/', (string) getenv('PC_DATABASE'))) {
            throw new RuntimeException('Admission controls require the isolated BDE database.');
        }
        $pdo = new \PDO('pgsql:host=127.0.0.1;port=5432;dbname=pc_setup', getenv('PC_SETUP'), getenv('DB_MIGRATION_PASSWORD'), [\PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION]);
        if ($pdo->query('SELECT system_identifier::text FROM pg_control_system()')->fetchColumn() !== getenv('PC_SYSTEM_ID')) {
            throw new RuntimeException('Independent admission-control identity mismatch.');
        }

        return $pdo;
    }

    public static function resetMode(): void
    {
        self::reopen();
        self::guard();
        $db = DB::connection('pgsql_migration');
        $role = getenv('PC_RUNTIME');
        $db->statement('REVOKE EXECUTE ON FUNCTION '.self::APPEND.' FROM "'.$role.'"');
        $db->statement('GRANT INSERT ON public.change_feed TO "'.$role.'"');
        $db->statement('GRANT USAGE,SELECT ON SEQUENCE public.change_feed_sequence_seq TO "'.$role.'"');
        $db->statement('GRANT UPDATE(feed_head,pruned_through,updated_at) ON public.sync_recovery_progress TO "'.$role.'"');
        $db->statement('UPDATE public.sync_publication_control SET active=false,activated_at=NULL');
        $db->statement('ALTER SEQUENCE public.change_feed_sequence_seq CACHE 1');
        config(['synchronization.coordinated_publication' => false]);
    }
}
