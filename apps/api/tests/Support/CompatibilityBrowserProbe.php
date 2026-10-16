<?php

use App\Models\User;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Tests\Support\PostgresTestDatabase;

// Explicit local test-only stdin bridge. No application route or network proxy.
if (getenv('B3_BROWSER_PROBE') !== 'isolated' || getenv('APP_ENV') !== 'testing'
    || ! preg_match('/\Amsprout_compat_b3_[a-z_]*test\z/', (string) getenv('DB_TEST_DATABASE'))
    || ! in_array(getenv('DB_HOST'), ['127.0.0.1', 'localhost'], true)) {
    throw new RuntimeException('Refusing non-isolated B3 browser probe.');
}
$stage = 'boot';
try {
    foreach (['DB_URL' => '', 'APP_CONFIG_CACHE' => sys_get_temp_dir().'/b3-browser-config-'.bin2hex(random_bytes(8)).'.php'] as $name => $value) {
        putenv($name.'='.$value);
        $_ENV[$name] = $value;
        $_SERVER[$name] = $value;
    }
    require dirname(__DIR__, 2).'/vendor/autoload.php';
    require dirname(__DIR__).'/bootstrap.php';
    $app = require dirname(__DIR__, 2).'/bootstrap/app.php';
    $kernel = $app->make(Kernel::class);
    $kernel->bootstrap();
    if (config('database.connections.pgsql.database') !== getenv('DB_TEST_DATABASE')
        || config('database.connections.pgsql.username') !== getenv('DB_TEST_RUNTIME_USERNAME')) {
        throw new RuntimeException('Unsafe browser probe database configuration.');
    }
    PostgresTestDatabase::refresh();
    $stage = 'seed';
    $db = DB::connection('pgsql_migration');
    $uuid = static fn (int $suffix): string => '00000000-0000-4000-8000-'.str_pad((string) $suffix, 12, '0', STR_PAD_LEFT);
    $church = $uuid(10);
    $ministry = $uuid(20);
    $membership = $uuid(40);
    $actor = User::factory()->create(['id' => 11, 'email_verified_at' => now()]);
    $owner = User::factory()->create(['id' => 12, 'email_verified_at' => now()]);
    $db->beginTransaction();
    $db->table('churches')->insert(['id' => $church, 'name' => 'B3 isolated church', 'slug' => 'b3-isolated', 'timezone' => 'Asia/Manila', 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);
    $db->table('church_memberships')->insert(['id' => $uuid(49), 'church_id' => $church, 'user_id' => $owner->id, 'role' => 'owner', 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);
    $db->table('church_memberships')->insert(['id' => $membership, 'church_id' => $church, 'user_id' => 11, 'role' => 'teacher', 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);
    $db->table('ministries')->insert(['id' => $ministry, 'church_id' => $church, 'name' => 'B3 isolated ministry', 'created_at' => now(), 'updated_at' => now()]);
    $db->table('teacher_ministry_assignments')->insert(['id' => $uuid(41), 'church_id' => $church, 'membership_id' => $membership, 'ministry_id' => $ministry, 'assigned_by' => $owner->id, 'created_at' => now(), 'updated_at' => now()]);
    foreach ([31, 32] as $id) {
        $db->table('students')->insert(['id' => $uuid($id), 'church_id' => $church, 'first_name' => 'B3 synthetic', 'last_name' => (string) $id, 'gender' => 'unspecified', 'version' => 1, 'created_at' => now(), 'updated_at' => now()]);
        $db->table('enrollments')->insert(['id' => $uuid($id + 100), 'church_id' => $church, 'ministry_id' => $ministry, 'student_id' => $uuid($id), 'version' => 1, 'created_at' => now(), 'updated_at' => now()]);
    }
    $db->commit();
} catch (Throwable $error) {
    echo json_encode(['probe_error' => get_class($error), 'phase' => $stage, 'status' => (string) $error->getCode()])."\n";
    exit(1);
}
$request = static function (array $input) use ($kernel, $actor, $church): array {
    $path = $input['path'] ?? '';
    if (! preg_match('~\A/api/sync/(push|pull)(?:\?[a-z0-9=&%]+)?\z~', $path)) {
        throw new RuntimeException('Unsupported probe path');
    }
    $server = ['HTTP_ACCEPT' => 'application/json', 'CONTENT_TYPE' => 'application/json', 'HTTP_ORIGIN' => 'http://localhost', 'HTTP_X_CHURCH_ID' => $church];
    foreach (['x-device-id' => 'HTTP_X_DEVICE_ID', 'x-msprout-attendance-reader' => 'HTTP_X_MSPROUT_ATTENDANCE_READER'] as $name => $target) {
        if (isset($input['headers'][$name])) {
            $server[$target] = $input['headers'][$name];
        }
    }
    config(['sanctum.stateful' => ['localhost']]);
    $http = Request::create($path, str_contains($path, '/push') ? 'POST' : 'GET', [], [], [], $server, isset($input['body']) ? json_encode($input['body'], JSON_THROW_ON_ERROR) : null);
    app()->instance('request', $http);
    Auth::guard('web')->setUser($actor);
    $response = $kernel->handle($http);
    $result = ['status' => $response->getStatusCode(), 'body' => json_decode($response->getContent(), true, 512, JSON_THROW_ON_ERROR)];
    $kernel->terminate($http, $response);

    return $result;
};
$snapshot = static function () use ($db): array {
    $result = [];
    foreach (['sync_events', 'attendance_sessions', 'attendance_records', 'attendance_guests', 'attendance_revisions', 'sync_conflicts', 'audit_events', 'change_feed', 'device_cursors', 'offline_authorizations', 'students', 'enrollments'] as $table) {
        $result[$table] = hash('sha256', $db->table($table)->orderBy('id')->get()->toJson());
    }

    return $result;
};
$first = null;
$before = null;
$stage = 'initialize';
$accepted = null;
while (($line = fgets(STDIN)) !== false) {
    try {
        $input = json_decode($line, true, 512, JSON_THROW_ON_ERROR);
        if ($input['command'] === 'close') {
            break;
        }
        if ($input['command'] === 'initialize') {
            $stage = 'initial-draft';
            $first = $input['request'];
            $first['body']['events'] = [$first['body']['events'][0]];
            $device = $first['body']['device_id'];
            $db->table('offline_authorizations')->insert(['id' => $uuid(42), 'church_id' => $church, 'membership_id' => $membership, 'device_id' => $device, 'expires_at' => now()->addDays(14)]);
            $accepted = $request($first);
            if ($accepted['status'] !== 200 || $accepted['body']['results'][0]['status'] !== 'accepted') {
                throw new RuntimeException('Legacy draft not accepted');
            }
            if ($input['mode'] === 'blocked') {
                $stage = 'synthetic-evidence';
                $session = $first['body']['events'][0]['entity_id'];
                $db->table('sync_conflicts')->insert(['id' => $uuid(43), 'church_id' => $church, 'attendance_session_id' => $session,
                    'attendance_record_id' => $db->table('attendance_records')->where('attendance_session_id', $session)->value('id'),
                    'incoming_event_id' => $uuid(44), 'field' => 'state', 'base_version' => 1,
                    'existing_value' => json_encode(['state' => 'late']), 'incoming_value' => json_encode(['state' => 'present']),
                    'incoming_actor_id' => 11, 'incoming_device_id' => $device, 'incoming_correlation_id' => $uuid(45),
                    'incoming_occurred_at' => now(), 'incoming_received_at' => now(), 'was_finalized' => false, 'status' => 'open', 'created_at' => now(), 'updated_at' => now()]);
            }
            $before = $snapshot();
            $result = ['initialized' => true, 'realAcceptedReceipts' => $db->table('sync_events')->count()];
        } elseif ($input['command'] === 'replay' && $first !== null) {
            $stage = 'replay';
            $result = $request($first);
            $result['unchanged'] = $before === $snapshot();
        } elseif ($input['command'] === 'request' && $before !== null) {
            $stage = 'request';
            $result = $request($input['request']);
            $result['unchanged'] = $before === $snapshot();
        } else {
            throw new RuntimeException('Uninitialized browser probe');
        }
        echo json_encode($result, JSON_THROW_ON_ERROR)."\n";
    } catch (Throwable $error) {
        // Do not emit request bodies, database contents, credentials or raw exceptions.
        echo json_encode(['probe_error' => get_class($error), 'phase' => $stage, 'status' => $accepted['status'] ?? null, 'location' => basename($error->getFile()).':'.$error->getLine()])."\n";
        exit(1);
    }
}
