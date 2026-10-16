<?php

use App\Domain\Attendance\AttendanceCompatibility;
use App\Domain\Attendance\AttendanceCompatibilityException;
use App\Models\DeviceCursor;
use App\Models\User;
use GuzzleHttp\Client;
use GuzzleHttp\Cookie\CookieJar;
use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Promise\Utils;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;
use Tests\Support\ChurchScenario;
use Tests\Support\MembershipScenario;
use Tests\Support\PostgresTestDatabase;

beforeEach(function (): void {
    PostgresTestDatabase::refresh();
    [$this->owner, $this->church, $this->membership] = MembershipScenario::owner($this);
    $this->ministry = MembershipScenario::ministry($this->church->id);
    $this->device = (string) Str::uuid();
    $this->session = (string) Str::uuid();
    DB::connection('pgsql_migration')->table('offline_authorizations')->insert([
        'id' => (string) Str::uuid(), 'church_id' => $this->church->id,
        'membership_id' => $this->membership->id, 'device_id' => $this->device,
        'expires_at' => now()->addDays(10),
    ]);
    $this->withHeader('X-Device-Id', $this->device);
});

function b3Event(object $test, string $action = 'attendance.draft_created'): array
{
    return [
        'client_event_id' => (string) Str::uuid(), 'entity_id' => $test->session,
        'action' => $action, 'base_version' => 0, 'occurred_at' => now()->toISOString(),
        'payload' => $action === 'attendance.draft_created'
            ? ['ministry_id' => $test->ministry, 'attendance_date' => now()->toDateString(), 'student_ids' => []]
            : ['student_id' => (string) Str::uuid(), 'state' => 'late'],
    ];
}

function b3Push(object $test, array $events)
{
    return $test->postJson('/api/sync/push', ['device_id' => $test->device, 'batch_id' => (string) Str::uuid(), 'events' => $events]);
}

function b3Snapshot(): array
{
    $db = DB::connection('pgsql_migration');

    return collect(['sync_events', 'attendance_sessions', 'attendance_records', 'attendance_guests', 'attendance_revisions', 'sync_conflicts', 'audit_events', 'change_feed', 'device_cursors', 'offline_authorizations', 'students', 'enrollments'])
        ->mapWithKeys(fn ($table) => [$table => $db->table($table)->orderBy('id')->get()->toJson()])->all();
}

function b3Feed(object $test, string $state): void
{
    $session = (string) Str::uuid();
    DB::connection('pgsql_migration')->table('change_feed')->insert([
        'id' => (string) Str::uuid(), 'church_id' => $test->church->id, 'ministry_id' => $test->ministry,
        'entity_type' => 'attendance_session', 'entity_id' => $session, 'entity_version' => 1,
        'action' => 'upsert', 'payload_json' => json_encode(['id' => $session, 'ministry_id' => $test->ministry, 'attendance_date' => now()->toDateString(), 'version' => 1, 'status' => 'draft', 'records' => [['id' => (string) Str::uuid(), 'student_id' => (string) Str::uuid(), 'version' => 1, 'state' => $state]], 'guests' => []]), 'created_at' => now(),
    ]);
}

it('rejects invalid and unsupported declarations without progress', function (string $value, string $code): void {
    $before = b3Snapshot();
    $this->withHeader('X-MSprout-Attendance-Reader', $value)->getJson('/api/sync/pull')
        ->assertStatus(400)->assertJsonPath('code', $code);
    expect(b3Snapshot())->toBe($before);
})->with([
    ['', 'invalid_attendance_reader'], ['three-state-v1,three-state-v1', 'invalid_attendance_reader'],
    ['three state', 'invalid_attendance_reader'], ['late-v1', 'unsupported_attendance_reader'],
    ['future-v9', 'unsupported_attendance_reader'],
]);

it('refuses every incompatible pull position before cursor or lease effects', function (int $position): void {
    foreach (range(0, 2) as $index) {
        b3Feed($this, $index === $position ? 'late' : 'present');
    }
    $before = b3Snapshot();
    $response = $this->getJson('/api/sync/pull')->assertStatus(409)->assertJsonPath('code', 'attendance_compatibility_required');
    expect(array_keys($response->json()))->toBe(['code', 'message', 'correlation_id']);
    expect($response->headers->get('Cache-Control'))->toContain('no-store');
    expect(b3Snapshot())->toBe($before);
})->with([0, 1, 2]);

it('refuses whole upload batches in each position with no terminal or domain effects', function (int $position): void {
    $events = [b3Event($this), b3Event($this), b3Event($this)];
    $events[$position] = b3Event($this, 'attendance.student_marked');
    $before = b3Snapshot();
    b3Push($this, $events)->assertStatus(409)->assertJsonPath('code', 'attendance_compatibility_required');
    expect(b3Snapshot())->toBe($before);
})->with([0, 1, 2]);

it('preserves exact replay and refuses mixed replay fresh incompatible requests', function (): void {
    $event = b3Event($this);
    b3Push($this, [$event])->assertOk()->assertJsonPath('results.0.status', 'accepted');
    $before = b3Snapshot();
    b3Push($this, [$event, b3Event($this), b3Event($this, 'attendance.student_marked')])->assertStatus(409);
    expect(b3Snapshot())->toBe($before);
    b3Push($this, [$event])->assertOk()->assertJsonPath('results.0.status', 'duplicate')->assertJsonPath('results.0.original_status', 'accepted');
});

it('classifies full bootstrap separately without renewing or advancing', function (): void {
    DB::connection('pgsql_migration')->table('device_cursors')->insert([
        'id' => (string) Str::uuid(), 'church_id' => $this->church->id, 'membership_id' => $this->membership->id,
        'device_id' => $this->device, 'cursor' => 0, 'updated_at' => now(), 'full_resync_required' => true,
    ]);
    $before = b3Snapshot();
    $this->getJson('/api/sync/pull')->assertStatus(409)->assertJsonPath('code', 'full_bootstrap_required');
    expect(b3Snapshot())->toBe($before);
});

it('rolls back an actual cursor insert before the HTTP kernel renders compatibility refusal', function (): void {
    $before = b3Snapshot();
    DeviceCursor::created(function (): void {
        throw new AttendanceCompatibilityException;
    });
    $this->getJson('/api/sync/pull')->assertStatus(409)->assertJsonPath('code', 'attendance_compatibility_required');
    expect(b3Snapshot())->toBe($before);
});

function b3Conflict(object $test, string $state = 'late'): string
{
    $id = (string) Str::uuid();
    DB::connection('pgsql_migration')->table('sync_conflicts')->insert([
        'id' => $id, 'church_id' => $test->church->id, 'attendance_session_id' => $test->session,
        'attendance_record_id' => null, 'field' => 'state', 'base_version' => 1,
        'incoming_device_id' => $test->device, 'incoming_event_id' => (string) Str::uuid(),
        'incoming_correlation_id' => (string) Str::uuid(),
        'existing_value' => json_encode(['state' => $state]), 'incoming_value' => json_encode(['state' => 'present']),
        'incoming_actor_id' => $test->owner->id, 'incoming_occurred_at' => now(), 'incoming_received_at' => now(),
        'was_finalized' => false, 'status' => 'open', 'created_at' => now(), 'updated_at' => now(),
    ]);

    return $id;
}

it('replays original receipts after incompatible evidence appears but refuses fresh session mutations', function (): void {
    $event = b3Event($this);
    b3Push($this, [$event])->assertOk();
    b3Conflict($this);
    $before = b3Snapshot();
    b3Push($this, [$event])->assertOk()->assertJsonPath('results.0.status', 'duplicate');
    expect(b3Snapshot())->toBe($before);
    $fresh = b3Event($this, 'attendance.finalized');
    $fresh['payload'] = [];
    $fresh['base_version'] = 1;
    b3Push($this, [$fresh])->assertStatus(409);
    expect(b3Snapshot())->toBe($before);
});

it('refuses owner conflict representations without exposing synthetic unsupported evidence', function (): void {
    b3Push($this, [b3Event($this)])->assertOk();
    $id = b3Conflict($this);
    $before = b3Snapshot();
    foreach (['/api/sync-conflicts', '/api/sync-conflicts/'.$id] as $url) {
        $response = $this->getJson($url)->assertStatus(409)->assertJsonPath('code', 'attendance_compatibility_required');
        expect($response->getContent())->not->toContain('late');
    }
    expect(b3Snapshot())->toBe($before);
});

it('checks report contributing sessions beyond the display limit and refuses CSV before success audit', function (): void {
    $db = DB::connection('pgsql_migration');
    for ($index = 0; $index < 101; $index++) {
        $id = $index === 100 ? $this->session : (string) Str::uuid();
        $db->table('attendance_sessions')->insert([
            'id' => $id, 'church_id' => $this->church->id, 'ministry_id' => $this->ministry,
            'attendance_date' => now()->subDays($index)->toDateString(), 'status' => 'finalized', 'version' => 1,
            'finalized_at' => now()->subDays($index), 'finalized_by' => $this->owner->id,
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }
    b3Conflict($this);
    $before = b3Snapshot();
    $query = '?date_from='.now()->subDays(110)->toDateString().'&date_to='.now()->toDateString();
    $this->getJson('/api/attendance-reports'.$query)->assertStatus(409);
    $response = $this->get('/api/attendance-reports/export'.$query, ['Accept' => 'text/csv'])->assertStatus(409);
    expect($response->headers->get('Content-Type'))->toContain('application/json');
    expect($response->getContent())->not->toContain('attendance_date,ministry');
    expect(b3Snapshot())->toBe($before);
});

it('refuses each fresh session mutation with synthetic unsupported conflict evidence', function (string $action, array $payload): void {
    b3Push($this, [b3Event($this)])->assertOk();
    b3Conflict($this);
    $event = b3Event($this, $action);
    $event['base_version'] = 1;
    $event['payload'] = $payload;
    $before = b3Snapshot();
    b3Push($this, [$event])->assertStatus(409);
    expect(b3Snapshot())->toBe($before);
})->with([
    ['attendance.student_marked', ['student_id' => '11111111-1111-4111-8111-111111111111', 'state' => 'present']],
    ['attendance.bulk_marked', ['student_ids' => [], 'state' => 'absent']],
    ['attendance.guest_added', ['display_name' => 'Synthetic B3 guest']],
    ['attendance.finalized', []],
]);

it('retains authorization-filtered gaps without disclosing hidden incompatible payloads', function (): void {
    b3Feed($this, 'late');
    [$teacher, $membership] = ChurchScenario::teacher($this->church);
    DB::connection('pgsql_migration')->table('offline_authorizations')->insert([
        'id' => (string) Str::uuid(), 'church_id' => $this->church->id, 'membership_id' => $membership->id,
        'device_id' => $this->device, 'expires_at' => now()->addDays(10),
    ]);
    $this->actingAs(User::findOrFail($teacher->id), 'web');
    $this->getJson('/api/sync/pull')->assertOk()->assertJsonCount(0, 'changes');
    expect(DB::connection('pgsql_migration')->table('device_cursors')->where('membership_id', $membership->id)->value('cursor'))->toBeGreaterThan(0);
});

it('recognizes observable duplicate declarations without accepting a combined capability', function (): void {
    $request = Request::create('/api/sync/pull');
    $request->headers->set('X-MSprout-Attendance-Reader', ['three-state-v1', 'three-state-v1']);
    expect(fn () => app(AttendanceCompatibility::class)->declaration($request))
        ->toThrow(AttendanceCompatibilityException::class);
});

it('refuses owner correction and conflict choices before append-only domain writes', function (string $operation): void {
    b3Push($this, [b3Event($this)])->assertOk();
    $db = DB::connection('pgsql_migration');
    $student = (string) Str::uuid();
    $record = (string) Str::uuid();
    $db->table('students')->insert(['id' => $student, 'church_id' => $this->church->id, 'first_name' => 'Synthetic', 'last_name' => 'B3', 'gender' => 'unspecified', 'version' => 1, 'created_at' => now(), 'updated_at' => now()]);
    $db->table('attendance_records')->insert(['id' => $record, 'church_id' => $this->church->id, 'attendance_session_id' => $this->session, 'student_id' => $student, 'state' => 'present', 'version' => 1, 'created_at' => now(), 'updated_at' => now()]);
    $id = b3Conflict($this);
    $db->table('sync_conflicts')->where('id', $id)->update(['attendance_record_id' => $record]);
    $db->table('attendance_sessions')->where('id', $this->session)->update(['status' => 'finalized', 'finalized_by' => $this->owner->id, 'finalized_at' => now()]);
    $before = b3Snapshot();
    if ($operation === 'correction') {
        $this->postJson('/api/attendance-sessions/'.$this->session.'/records/'.$record.'/corrections', ['state' => 'absent', 'reason' => 'Synthetic B3 review'])->assertStatus(409);
    } else {
        $this->postJson('/api/sync-conflicts/'.$id.'/resolve', ['choice' => $operation, 'reason' => 'Synthetic B3 review'])->assertStatus(409);
    }
    expect(b3Snapshot())->toBe($before);
})->with(['correction', 'existing', 'incoming']);

it('refuses guest resolution before student enrollment guest or feed mutations', function (string $operation): void {
    $draft = b3Event($this);
    $guest = b3Event($this, 'attendance.guest_added');
    $guest['base_version'] = 1;
    $guest['payload'] = ['display_name' => 'Synthetic B3'];
    b3Push($this, [$draft, $guest])->assertOk();
    $guestId = DB::connection('pgsql_migration')->table('attendance_guests')->value('id');
    b3Conflict($this);
    $input = match ($operation) {
        'promote' => ['first_name' => 'Synthetic', 'last_name' => 'B3'],
        'link' => ['student_id' => (string) Str::uuid()],
        'merge' => ['guest_id' => (string) Str::uuid()],
    };
    $before = b3Snapshot();
    $this->postJson('/api/attendance-guests/'.$guestId.'/'.$operation, $input)->assertStatus(409);
    expect(b3Snapshot())->toBe($before);
})->with(['promote', 'link', 'merge']);

it('proves refusal rollback and concurrent success over real loopback HTTP', function (string $mode): void {
    [$teacher, $membership] = ChurchScenario::teacher($this->church);
    $user = User::findOrFail($teacher->id);
    $password = Str::password(32);
    $user->forceFill(['password' => $password])->save();
    $db = DB::connection('pgsql_migration');
    $db->table('teacher_ministry_assignments')->insert(['id' => (string) Str::uuid(), 'church_id' => $this->church->id, 'membership_id' => $membership->id, 'ministry_id' => $this->ministry, 'assigned_by' => $this->owner->id, 'created_at' => now(), 'updated_at' => now()]);
    $db->table('offline_authorizations')->insert(['id' => (string) Str::uuid(), 'church_id' => $this->church->id, 'membership_id' => $membership->id, 'device_id' => $this->device, 'expires_at' => now()->addDays(10)]);
    if ($mode === 'concurrent') {
        b3Feed($this, 'present');
    }
    if (! in_array($mode, ['rollback', 'upload-rollback'], true)) {
        b3Feed($this, 'late');
    }
    $socket = stream_socket_server('tcp://127.0.0.1:0');
    if ($socket === false) {
        throw new RuntimeException('No isolated HTTP port');
    }
    $address = stream_socket_get_name($socket, false);
    fclose($socket);
    $server = new Process([PHP_BINARY, '-S', $address, 'tests/Support/CompatibilityHttpRouter.php'], base_path(), array_merge(getenv(), [
        'APP_ENV' => 'local', 'APP_DEBUG' => 'false', 'APP_URL' => 'http://'.$address, 'APP_KEY' => config('app.key'),
        'APP_CONFIG_CACHE' => sys_get_temp_dir().'/b3-http-config-'.Str::uuid().'.php', 'DB_URL' => '',
        'SESSION_DRIVER' => 'database', 'SESSION_CONNECTION' => 'pgsql', 'SESSION_DOMAIN' => '127.0.0.1',
        'SANCTUM_STATEFUL_DOMAINS' => $address, 'CACHE_STORE' => 'array', 'MAIL_MAILER' => 'array', 'QUEUE_CONNECTION' => 'sync',
        'B3_TEST_HTTP' => 'isolated', 'B3_HTTP_FAULT' => match ($mode) {
            'rollback' => 'cursor', 'upload-rollback' => 'receipt', default => ''
        },
        'PHP_CLI_SERVER_WORKERS' => $mode === 'concurrent' ? '2' : false,
    ]));
    $cookies = new CookieJar;
    $client = new Client(['base_uri' => 'http://'.$address, 'cookies' => $cookies, 'http_errors' => false, 'timeout' => 5,
        'headers' => ['Accept' => 'application/json', 'Origin' => 'http://'.$address, 'X-Church-Id' => $this->church->id, 'X-Device-Id' => $this->device]]);
    try {
        $server->start();
        $ready = false;
        $deadline = microtime(true) + 15;
        do {
            if (! $server->isRunning()) {
                throw new RuntimeException('Isolated B3 HTTP server stopped');
            }
            try {
                $ready = $client->get('/health/live')->getStatusCode() === 200;
            } catch (ConnectException) {
                usleep(50_000);
            }
        } while (! $ready && microtime(true) < $deadline);
        expect($ready)->toBeTrue();
        $client->get('/sanctum/csrf-cookie');
        $csrf = $cookies->getCookieByName('XSRF-TOKEN');
        expect($csrf)->not->toBeNull();
        expect($client->post('/login', ['headers' => ['X-XSRF-TOKEN' => urldecode($csrf->getValue())], 'json' => ['email' => $user->email, 'password' => $password]])->getStatusCode())->toBe(200);
        $before = b3Snapshot();
        $correlation = (string) Str::uuid();
        if ($mode === 'concurrent') {
            $responses = Utils::unwrap([
                $client->getAsync('/api/sync/pull?cursor=0&limit=2'),
                $client->getAsync('/api/sync/pull?cursor=0&limit=1'),
            ]);
            expect($responses[0]->getStatusCode())->toBe(409);
            expect($responses[1]->getStatusCode())->toBe(200);
            $success = json_decode((string) $responses[1]->getBody(), true, 512, JSON_THROW_ON_ERROR);
            expect((string) $db->table('device_cursors')->where('membership_id', $membership->id)->value('cursor'))->toBe($success['page']['next_cursor']);
            expect($db->table('sync_events')->count())->toBe(0);
            expect($db->table('audit_events')->where('action', 'offline.authorization.issued')->count())->toBe(1);

            return;
        }
        $response = $mode === 'upload-rollback'
            ? $client->post('/api/sync/push', ['headers' => ['X-Correlation-Id' => $correlation, 'X-XSRF-TOKEN' => urldecode($cookies->getCookieByName('XSRF-TOKEN')->getValue())], 'json' => ['device_id' => $this->device, 'batch_id' => (string) Str::uuid(), 'events' => [b3Event($this)]]])
            : $client->get('/api/sync/pull', ['headers' => ['X-Correlation-Id' => $correlation]]);
        expect($response->getStatusCode())->toBe(409);
        $body = json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR);
        expect($body)->toHaveKeys(['code', 'message', 'correlation_id']);
        expect($body['code'])->toBe('attendance_compatibility_required');
        expect($body['correlation_id'])->toBe($correlation);
        expect(b3Snapshot())->toBe($before);
    } finally {
        // Never emit process output, cookies, credentials or session bodies.
        $server->stop();
    }
})->with(['refusal', 'rollback', 'upload-rollback', 'concurrent']);
