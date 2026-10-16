<?php

declare(strict_types=1);
use App\Actions\Attendance\CorrectAttendance;
use App\Jobs\PurgeRevokedDeviceData;
use App\Models\AttendanceRecord;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Tests\Support\PostgresTestDatabase;

// This guard deliberately precedes autoload, Laravel and tests/bootstrap.php.
if (getenv('P1_ISOLATED') !== 'yes' || getenv('APP_ENV') !== 'testing'
    || getenv('DB_HOST') !== '127.0.0.1' || getenv('DB_PORT') !== '5432'
    || getenv('DB_URL') !== '' || getenv('DATABASE_URL') !== '' || file_exists('/work/.env')
    || ! preg_match('/\Ap1_[a-f0-9]{10}_test\z/', (string) getenv('P1_DATABASE'))
    || getenv('DB_TEST_DATABASE') !== getenv('P1_DATABASE')
    || getenv('DB_TEST_RUNTIME_USERNAME') !== getenv('P1_RUNTIME')
    || getenv('P1_RUNTIME') === getenv('P1_SETUP')
    || ! preg_match('/\Ap1_runtime_[a-f0-9]{10}\z/', (string) getenv('P1_RUNTIME'))
    || getenv('DB_MIGRATION_USERNAME') !== getenv('P1_SETUP')) {
    throw new RuntimeException('P1 isolation guard refused bootstrap.');
}
$setup = new PDO('pgsql:host=127.0.0.1;port=5432;dbname=p1_setup', getenv('P1_SETUP'), getenv('DB_MIGRATION_PASSWORD'), [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$setup->beginTransaction();
$setup->exec('SET TRANSACTION READ ONLY');
$identity = $setup->query("SELECT system_identifier::text AS id, current_database() AS db, current_user AS actor, current_setting('server_version_num')::int AS version FROM pg_control_system()")->fetch(PDO::FETCH_ASSOC);
if ($identity['id'] !== getenv('P1_SYSTEM_ID') || $identity['db'] !== 'p1_setup' || $identity['actor'] !== getenv('P1_SETUP') || $identity['version'] < 180000 || $identity['version'] >= 190000) {
    throw new RuntimeException('P1 independent server identity check failed.');
}
$setup->rollBack();
$setup = null;
require '/work/vendor/autoload.php';
require '/work/tests/bootstrap.php';
$app = require '/work/bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();
$app->instance('request', Request::create('http://localhost/'));
if (config('database.connections.pgsql.database') !== getenv('P1_DATABASE') || config('database.connections.pgsql.username') !== getenv('P1_RUNTIME')) {
    throw new RuntimeException('P1 runtime identity mismatch.');
}
PostgresTestDatabase::refresh();
putenv('P1_ROLE_INITIALIZED=yes');

function uid(int $n): string
{
    return '00000000-0000-4000-8000-'.str_pad((string) $n, 12, '0', STR_PAD_LEFT);
}
function must(bool $condition, string $message): void
{
    if (! $condition) {
        throw new RuntimeException($message);
    }
}
function admin()
{
    return DB::connection('pgsql_migration');
}
function actor()
{
    return User::findOrFail(11);
}
function seed(): array
{
    must(config('cache.default') === 'array', 'Fixture cache must be disposable memory');
    // Each scenario is independent, like a fresh test application. Preserve real limit values.
    Cache::flush();
    PostgresTestDatabase::refresh();
    $db = admin();
    User::factory()->create(['id' => 11, 'email_verified_at' => now()]);
    User::factory()->create(['id' => 12, 'email_verified_at' => now()]);
    $db->transaction(function () use ($db): void {
        foreach ([10, 110] as $church) {
            $db->table('churches')->insert(['id' => uid($church), 'name' => 'P1 synthetic church', 'slug' => 'p1-'.$church, 'timezone' => 'Asia/Taipei', 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);
            $db->table('church_memberships')->insert(['id' => uid($church + 39), 'church_id' => uid($church), 'user_id' => 12, 'role' => 'owner', 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);
        }
        $db->table('church_memberships')->insert(['id' => uid(40), 'church_id' => uid(10), 'user_id' => 11, 'role' => 'teacher', 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);
        $db->table('ministries')->insert(['id' => uid(20), 'church_id' => uid(10), 'name' => 'P1 synthetic ministry', 'created_at' => now(), 'updated_at' => now()]);
        $db->table('teacher_ministry_assignments')->insert(['id' => uid(41), 'church_id' => uid(10), 'membership_id' => uid(40), 'ministry_id' => uid(20), 'assigned_by' => 12, 'created_at' => now(), 'updated_at' => now()]);
        $db->table('students')->insert(['id' => uid(31), 'church_id' => uid(10), 'first_name' => 'P1', 'last_name' => 'Synthetic', 'gender' => 'unspecified', 'version' => 1, 'created_at' => now(), 'updated_at' => now()]);
        $db->table('enrollments')->insert(['id' => uid(131), 'church_id' => uid(10), 'ministry_id' => uid(20), 'student_id' => uid(31), 'version' => 1, 'created_at' => now(), 'updated_at' => now()]);
    });
    Auth::guard('web')->setUser(actor());

    return ['church' => uid(10), 'membership' => uid(40), 'ministry' => uid(20), 'student' => uid(31), 'actor' => '11'];
}
function p1Request(string $path, ?array $body = null, ?string $device = null): array
{
    global $kernel, $app;
    must((bool) preg_match('~\A/api/(offline/bootstrap\?device_id=[a-f0-9-]+|sync/push|sync/pull\?cursor=\d+&limit=100)\z~', $path), 'Non-allowlisted proof request');
    $server = ['HTTP_ACCEPT' => 'application/json', 'CONTENT_TYPE' => 'application/json', 'HTTP_ORIGIN' => 'http://localhost', 'HTTP_X_CHURCH_ID' => uid(10), 'HTTP_X_MSPROUT_ATTENDANCE_READER' => 'three-state-v1'];
    if ($device) {
        $server['HTTP_X_DEVICE_ID'] = $device;
    }
    config(['sanctum.stateful' => ['localhost']]);
    $http = Request::create($path, $body === null ? 'GET' : 'POST', [], [], [], $server, $body === null ? null : json_encode($body, JSON_THROW_ON_ERROR));
    $app->instance('request', $http);
    Auth::guard('web')->setUser(actor());
    $response = $kernel->handle($http);
    $result = ['status' => $response->getStatusCode(), 'body' => json_decode($response->getContent(), true, 512, JSON_THROW_ON_ERROR)];
    $kernel->terminate($http, $response);
    must($result['status'] === 200, 'Proof HTTP status '.$result['status'].' code '.($result['body']['code'] ?? 'none'));

    return $result;
}
function bootstrap(string $device): array
{
    return p1Request('/api/offline/bootstrap?device_id='.$device)['body'];
}
function p1Event(string $session, string $event, string $action, int $version, array $payload): array
{
    return ['client_event_id' => $event, 'entity_id' => $session, 'action' => $action, 'base_version' => $version, 'occurred_at' => now('UTC')->toISOString(), 'payload' => $payload];
}
function push(string $device, array $events): array
{
    return p1Request('/api/sync/push', ['device_id' => $device, 'batch_id' => uid(random_int(10000, 99999)), 'events' => $events])['body'];
}
function initial(string $device, int $session = 50): array
{
    bootstrap($device);
    $e = p1Event(uid($session), uid($session + 1000), 'attendance.draft_created', 0, ['ministry_id' => uid(20), 'attendance_date' => now('Asia/Taipei')->subDays($session - 50)->format('Y-m-d'), 'student_ids' => [uid(31)]]);
    must(push($device, [$e])['results'][0]['status'] === 'accepted', 'Initial event not accepted');

    return $e;
}
function prune(): array
{
    return DB::selectOne("SELECT prune_operational_data(clock_timestamp()-interval '31 days', clock_timestamp()-interval '181 days', clock_timestamp()-interval '180 days', clock_timestamp()-interval '90 days') AS result")->result ? ['executed' => true] : [];
}
function worker(array $input): array
{
    $pipes = [];
    $p = proc_open(['php', '/proofs/worker.php'], [['pipe', 'r'], ['pipe', 'w'], ['pipe', 'w']], $pipes, '/work');
    must(is_resource($p), 'Worker not started');
    fwrite($pipes[0], json_encode($input, JSON_THROW_ON_ERROR)."\n");
    $line = fgets($pipes[1]);
    must(is_string($line), 'Worker barrier unavailable');
    $first = json_decode($line, true, 512, JSON_THROW_ON_ERROR);
    must(! isset($first['error']), 'Worker rejected setup');

    return [$p, $pipes, $first];
}
function finishWorker(array $w): array
{
    [$p, $pipes] = $w;
    fwrite($pipes[0], "commit\n");
    fclose($pipes[0]);
    $last = json_decode((string) fgets($pipes[1]), true, 512, JSON_THROW_ON_ERROR);
    fclose($pipes[1]);
    $errors = stream_get_contents($pipes[2]);
    fclose($pipes[2]);
    must(proc_close($p) === 0 && $errors === '', 'Worker exit failure');

    return $last;
}
function proofs(): array
{
    seed();
    $device = uid(200);
    initial($device);
    $e = p1Event(uid(50), uid(2050), 'attendance.student_marked', 1, ['student_id' => uid(31), 'state' => 'present']);
    $accepted = push($device, [$e]);
    must($accepted['results'][0]['status'] === 'accepted', 'Original upload not accepted');
    $duplicate = push($device, [$e]);
    must($duplicate['results'][0]['status'] === 'duplicate', 'Surviving receipt control failed');
    admin()->table('sync_events')->where('client_event_id', $e['client_event_id'])->update(['received_at' => now('UTC')->subDays(181)]);
    prune();
    must(! admin()->table('sync_events')->where('client_event_id', $e['client_event_id'])->exists(), 'Receipt did not expire');
    $retry = push($device, [$e]);
    $never = $e;
    $never['client_event_id'] = uid(2051);
    $coincidence = push($device, [$never]);
    must($retry['results'][0]['status'] === 'accepted' && $coincidence['results'][0]['status'] === 'accepted', 'Receipt ambiguity witness changed');
    // An actual Owner correction, after a legitimate finalization.
    $final = p1Event(uid(50), uid(2052), 'attendance.finalized', 2, []);
    must(push($device, [$final])['results'][0]['status'] === 'accepted', 'Finalization failed');
    $owner = User::findOrFail(12);
    Auth::guard('web')->setUser($owner);
    app(TenantContext::class)->run(uid(10), function () use ($owner): void {
        $record = AttendanceRecord::query()->firstOrFail();
        app(CorrectAttendance::class)->handle(uid(50), $record->id, 'absent', 'P1 synthetic correction', $owner);
    });
    admin()->table('sync_events')->where('client_event_id', $e['client_event_id'])->update(['received_at' => now('UTC')->subDays(181)]);
    prune();
    $afterCorrection = push($device, [$e]);
    must($afterCorrection['results'][0]['status'] === 'conflict', 'Corrected-original ambiguity not established');
    $b403 = ['verdict' => 'REPRODUCED', 'survivingReceipt' => $duplicate, 'lostOriginalAfterExpiry' => $retry, 'neverAppliedCoincidence' => $coincidence, 'lostOriginalAfterCorrection' => $afterCorrection, 'safetyAssertion' => ['expected' => 'unresolved hold', 'actual' => 'fresh accepted/conflict receipt', 'expectedExitStatus' => 1]];

    seed();
    $device = uid(200);
    initial($device, 50);
    initial($device, 51);
    $base = (string) admin()->table('change_feed')->max('sequence');
    $a = worker(['session' => uid(50)]);
    $b = worker(['session' => uid(51)]);
    must($a[2]['sequence'] < $b[2]['sequence'], 'Allocation control failed');
    $bc = finishWorker($b);
    $firstPull = p1Request('/api/sync/pull?cursor='.$base.'&limit=100', null, $device)['body'];
    must(count($firstPull['changes']) === 1 && $firstPull['changes'][0]['sequence'] === (string) $b[2]['sequence'], 'Later commit not independently visible');
    $ac = finishWorker($a);
    $next = p1Request('/api/sync/pull?cursor='.$firstPull['page']['next_cursor'].'&limit=100', null, $device)['body'];
    must(count($next['changes']) === 0 && admin()->table('change_feed')->where('sequence', $a[2]['sequence'])->exists(), 'Late commit skip not established');
    $b404 = ['verdict' => 'REPRODUCED', 'aAllocated' => $a[2], 'bAllocated' => $b[2], 'bCommit' => $bc, 'aCommit' => $ac, 'firstCursor' => $firstPull['page']['next_cursor'], 'secondChanges' => count($next['changes']), 'lateRowStillExists' => true, 'safetyAssertion' => ['expected' => 'every committed change delivered', 'actual' => 'earlier allocated change skipped', 'expectedExitStatus' => 1]];

    // Test-only coordination control: inspect actual pg_blocking_pids before release.
    $a = worker(['session' => uid(50), 'coordinated' => true]);
    fwrite($a[1][0], "enter\n");
    $aAllocated = json_decode((string) fgets($a[1][1]), true, 512, JSON_THROW_ON_ERROR);
    $b = worker(['session' => uid(51), 'coordinated' => true]);
    fwrite($b[1][0], "enter\n");
    $deadline = microtime(true) + 10;
    do {
        $blocked = admin()->selectOne('SELECT ? = ANY(pg_blocking_pids(?)) AS blocked', [$a[2]['pid'], $b[2]['pid']])->blocked;
        if (microtime(true) > $deadline) {
            throw new RuntimeException('No database-observed coordination wait');
        }
    } while (! $blocked);
    // A separate church must still publish while A holds its church lock.
    admin()->table('ministries')->insert(['id' => uid(120), 'church_id' => uid(110), 'name' => 'P1 other church', 'created_at' => now(), 'updated_at' => now()]);
    admin()->table('attendance_sessions')->insert(['id' => uid(150), 'church_id' => uid(110), 'ministry_id' => uid(120), 'attendance_date' => now()->format('Y-m-d'), 'status' => 'draft', 'version' => 1, 'created_at' => now(), 'updated_at' => now()]);
    $other = worker(['session' => uid(150), 'church' => uid(110), 'coordinated' => true]);
    fwrite($other[1][0], "enter\n");
    $otherAllocated = json_decode((string) fgets($other[1][1]), true, 512, JSON_THROW_ON_ERROR);
    must(isset($otherAllocated['sequence']), 'Other-church gate failed');
    $otherCommit = finishWorker($other);
    finishWorker($a);
    $bAllocated = json_decode((string) fgets($b[1][1]), true, 512, JSON_THROW_ON_ERROR);
    finishWorker($b);
    must($aAllocated['sequence'] < $bAllocated['sequence'], 'Coordinated order control failed');
    $b404['coordinationControl'] = ['testOnly' => true, 'databaseObservedWait' => $blocked, 'a' => $aAllocated, 'b' => $bAllocated, 'otherChurchCommittedDuringWait' => $otherCommit];

    // Exact SQL-cutoff boundaries, including clock_timestamp rather than PHP time.
    seed();
    $d = uid(200);
    initial($d);
    $t = admin()->selectOne("SELECT date_trunc('second', clock_timestamp())::text AS t")->t;
    $feedCut = admin()->selectOne("SELECT (?::timestamptz-interval '90 days')::text AS t", [$t])->t;
    $receiptCut = admin()->selectOne("SELECT (?::timestamptz-interval '180 days')::text AS t", [$t])->t;
    $seqs = [];
    foreach ([-1, 0, 1] as $delta) {
        $seqs[$delta] = admin()->table('change_feed')->insertGetId(['id' => uid(300 + $delta), 'church_id' => uid(10), 'ministry_id' => uid(20), 'entity_type' => 'attendance_session', 'entity_id' => uid(50), 'entity_version' => 1, 'action' => 'upsert', 'payload_json' => '{}', 'created_at' => admin()->raw("'".$feedCut."'::timestamptz + interval '".$delta." seconds'")], 'sequence');
        admin()->table('sync_events')->insert(['id' => uid(400 + $delta), 'church_id' => uid(10), 'device_id' => $d, 'client_event_id' => uid(500 + $delta), 'batch_id' => uid(600), 'actor_id' => 11, 'payload_hash' => str_repeat('a', 64), 'result_status' => 'accepted', 'received_at' => admin()->raw("'".$receiptCut."'::timestamptz + interval '".$delta." seconds'"), 'correlation_id' => uid(601)]);
    }
    admin()->table('offline_authorizations')->update(['expires_at' => now()->subDay()]);
    DB::selectOne("SELECT prune_operational_data(?::timestamptz-interval '31 days', ?::timestamptz-interval '181 days', ?, ?)", [$t, $t, $receiptCut, $feedCut]);
    $boundaries = [];
    foreach ([-1, 0, 1] as $delta) {
        $boundaries[(string) $delta] = ['feedExists' => admin()->table('change_feed')->where('sequence', $seqs[$delta])->exists(), 'receiptExists' => admin()->table('sync_events')->where('client_event_id', uid(500 + $delta))->exists()];
        must($boundaries[(string) $delta]['feedExists'] === ($delta === 1) && $boundaries[(string) $delta]['receiptExists'] === ($delta === 1), 'Exact cutoff control failed');
    }
    $flagBeforeCleanup = (bool) admin()->table('device_cursors')->where('device_id', $d)->value('full_resync_required');
    app()->call([new PurgeRevokedDeviceData, 'handle']);
    $flagAfterCleanup = (bool) admin()->table('device_cursors')->where('device_id', $d)->value('full_resync_required');
    must(! $flagBeforeCleanup && $flagAfterCleanup, 'Scheduled-order flag gap not established');
    $dayCases = [];
    foreach ([89, 90, 91] as $days) {
        $seq = admin()->table('change_feed')->insertGetId(['id' => uid(700 + $days), 'church_id' => uid(10), 'ministry_id' => uid(20), 'entity_type' => 'attendance_session', 'entity_id' => uid(50), 'entity_version' => 1, 'action' => 'upsert', 'payload_json' => '{}', 'created_at' => admin()->raw("'".$t."'::timestamptz - interval '".$days." days'")], 'sequence');
        $dayCases['feed'.$days] = $seq;
    }
    foreach ([179, 180, 181] as $days) {
        admin()->table('sync_events')->insert(['id' => uid(1000 + $days), 'church_id' => uid(10), 'device_id' => $d, 'client_event_id' => uid(2000 + $days), 'batch_id' => uid(600), 'actor_id' => 11, 'payload_hash' => str_repeat('b', 64), 'result_status' => 'accepted', 'received_at' => admin()->raw("'".$t."'::timestamptz - interval '".$days." days'"), 'correlation_id' => uid(601)]);
    }
    DB::selectOne("SELECT prune_operational_data(?::timestamptz-interval '31 days', ?::timestamptz-interval '181 days', ?, ?)", [$t, $t, $receiptCut, $feedCut]);
    foreach ([89, 90, 91] as $days) {
        $dayCases['feed'.$days] = admin()->table('change_feed')->where('sequence', $dayCases['feed'.$days])->exists();
        must($dayCases['feed'.$days] === ($days === 89), 'Feed day boundary failed');
    }
    foreach ([179, 180, 181] as $days) {
        $dayCases['receipt'.$days] = admin()->table('sync_events')->where('client_event_id', uid(2000 + $days))->exists();
        must($dayCases['receipt'.$days] === ($days === 179), 'Receipt day boundary failed');
    }
    $rls = DB::selectOne('SELECT current_database() AS db, current_user AS actor, (SELECT count(*) FROM churches) AS unscoped_churches');
    must((int) $rls->unscoped_churches === 0 && $rls->actor === getenv('P1_RUNTIME'), 'Runtime tenant isolation failed');
    $scoped = app(TenantContext::class)->run(uid(10), function (): array {
        $own = DB::table('churches')->where('id', uid(10))->count();
        $foreign = DB::table('churches')->where('id', uid(110))->count();
        $denied = false;
        try {
            DB::transaction(fn () => DB::table('device_cursors')->insert(['id' => uid(9900), 'church_id' => uid(110), 'membership_id' => uid(149), 'device_id' => uid(9901), 'cursor' => 0, 'updated_at' => now()]));
        } catch (QueryException $error) {
            $denied = $error->getCode() === '42501';
        }
        must($own === 1 && $foreign === 0 && $denied, 'Scoped read/cross-tenant write control failed');

        return ['ownChurchRows' => $own, 'otherChurchRows' => $foreign, 'crossTenantWriteDenied42501' => $denied];
    });

    return ['verdicts' => ['B4-03' => 'REPRODUCED', 'B4-04' => 'REPRODUCED'], 'B4-03' => $b403, 'B4-04' => $b404, 'cutoffSeconds' => $boundaries, 'dayBoundaries' => $dayCases, 'scheduledOrder' => ['flagBeforeCleanup' => $flagBeforeCleanup, 'flagAfterCleanup' => $flagAfterCleanup], 'runtimeRls' => $rls, 'scopedRls' => $scoped];
}

while (($line = fgets(STDIN)) !== false) {
    try {
        $input = json_decode($line, true, 512, JSON_THROW_ON_ERROR);
        $command = $input['command'];
        if ($command === 'ready') {
            $role = admin()->selectOne('SELECT rolsuper, rolbypassrls, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname=?', [getenv('P1_RUNTIME')]);
            $tables = admin()->select("SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN ('change_feed','sync_events','device_cursors','attendance_sessions')");
            foreach ((array) $role as $flag) {
                must(! $flag, 'Unsafe runtime role');
            }
            foreach ($tables as $table) {
                must($table->relrowsecurity && $table->relforcerowsecurity, 'Forced RLS absent');
            }
            $result = ['ready' => true, 'guardBeforeBootstrap' => true, 'systemId' => $identity['id'], 'database' => getenv('P1_DATABASE'), 'runtime' => getenv('P1_RUNTIME'), 'role' => $role, 'rlsTables' => $tables];
        } elseif ($command === 'server-proofs') {
            $result = proofs();
        } elseif ($command === 'seed') {
            $result = seed();
        } elseif ($command === 'bootstrap') {
            $result = bootstrap($input['device']);
        } elseif ($command === 'push') {
            $result = p1Request('/api/sync/push', $input['body']);
        } elseif ($command === 'pull') {
            $result = p1Request('/api/sync/pull?cursor='.$input['cursor'].'&limit=100', null, $input['device']);
        } elseif ($command === 'age-prune') {
            admin()->table('change_feed')->update(['created_at' => now()->subDays(91)]);
            if ($input['expire'] ?? false) {
                admin()->table('offline_authorizations')->update(['expires_at' => now()->subDay()]);
            }
            $before = admin()->table('change_feed')->count();
            prune();
            $result = ['before' => $before, 'remaining' => admin()->table('change_feed')->count(), 'serverCursor' => admin()->table('device_cursors')->value('cursor'), 'flag' => admin()->table('device_cursors')->value('full_resync_required')];
        } elseif ($command === 'state') {
            $result = ['sessionVersion' => admin()->table('attendance_sessions')->value('version'), 'state' => admin()->table('attendance_records')->value('state'), 'feedRows' => admin()->table('change_feed')->count(), 'serverCursor' => admin()->table('device_cursors')->value('cursor')];
        } else {
            throw new RuntimeException('Unknown isolated proof command');
        }
        echo json_encode($result, JSON_THROW_ON_ERROR)."\n";
    } catch (Throwable $error) {
        echo json_encode(['error' => get_class($error), 'message' => preg_replace('/[\r\n].*/s', '', $error->getMessage()), 'file' => basename($error->getFile()), 'line' => $error->getLine()])."\n";
    }
}
