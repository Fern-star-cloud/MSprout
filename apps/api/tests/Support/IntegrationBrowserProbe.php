<?php

declare(strict_types=1);

// Guard precedes every role/bootstrap/schema operation; never a public HTTP entry.
$argv = ['browser'];
require '/proofs/bootstrap.php';
require '/work/vendor/autoload.php';

use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\AuthorityScenario;
use Tests\Support\ChurchScenario;
use Tests\Support\IntegrationScenario;
use Tests\Support\MembershipScenario;
use Tests\Support\PostgresTestDatabase;

function browserApp(string $origin)
{
    $app = require '/work/bootstrap/app.php';
    $app->make(Kernel::class)->bootstrap();
    AuthorityScenario::guard();
    config(['app.url' => $origin, 'session.driver' => 'database', 'session.connection' => 'pgsql', 'logging.default' => 'null', 'mail.default' => 'array']);
    config(['sanctum.stateful' => [parse_url($origin, PHP_URL_HOST).':'.parse_url($origin, PHP_URL_PORT)]]);

    return $app;
}
echo json_encode(['ready' => true])."\n";
$origin = null;
$member = null;
while (($line = fgets(STDIN)) !== false) {
    try {
        $input = json_decode($line, true, 512, JSON_THROW_ON_ERROR);
        if ($input['command'] === 'close') {
            exit;
        }
        if ($input['command'] === 'initialize') {
            if ($origin !== null || ! preg_match('~\Ahttp://127\.0\.0\.1:[0-9]{4,5}\z~', $input['origin'])) {
                throw new RuntimeException('Foreign browser origin.');
            }
            $origin = $input['origin'];
            $app = browserApp($origin);
            PostgresTestDatabase::refresh();
            [$owner, $church] = ChurchScenario::owner();
            [$user, $membership] = ChurchScenario::teacher($church);
            $member = $membership->id;
            $actor = User::findOrFail($user->id);
            $password = Str::password(32);
            $actor->forceFill(['password' => $password])->save();
            $ministry = MembershipScenario::ministry($church->id);
            $db = DB::connection('pgsql_migration');
            $db->table('teacher_ministry_assignments')->insert(['id' => (string) Str::uuid(), 'church_id' => $church->id, 'membership_id' => $member, 'ministry_id' => $ministry, 'assigned_by' => $owner->id]);
            $student = (string) Str::uuid();
            $db->table('students')->insert(['id' => $student, 'church_id' => $church->id, 'first_name' => 'Synthetic', 'last_name' => 'Browser', 'gender' => 'unspecified', 'version' => 1]);
            $db->table('enrollments')->insert(['id' => (string) Str::uuid(), 'church_id' => $church->id, 'student_id' => $student, 'ministry_id' => $ministry, 'version' => 1]);
            // Disposable credentials exist only in process IPC/memory; never report or log.
            $result = ['initialized' => true, 'email' => $actor->email, 'password' => $password, 'church' => $church->id];
        } elseif ($origin === null) {
            throw new RuntimeException('Initialize isolated browser first.');
        } elseif ($input['command'] === 'activate') {
            $app = browserApp($origin);
            IntegrationScenario::activate();
            putenv('SYNC_COORDINATED_PUBLICATION=true');
            $_ENV['SYNC_COORDINATED_PUBLICATION'] = $_SERVER['SYNC_COORDINATED_PUBLICATION'] = 'true';
            $result = ['active' => true];
        } elseif ($input['command'] === 'revoke') {
            $app = browserApp($origin);
            $db = DB::connection('pgsql_migration');
            $db->transaction(fn () => $db->table('church_memberships')->where('id', $member)->update(['status' => 'revoked']));
            $result = ['revoked' => true];
        } elseif ($input['command'] === 'request') {
            $app = browserApp($origin);
            $app->instance('env', 'local');
            $url = parse_url($origin);
            $server = ['HTTP_HOST' => $url['host'].':'.$url['port'], 'SERVER_NAME' => $url['host'], 'SERVER_PORT' => $url['port']];
            foreach ($input['headers'] as $name => $value) {
                if (in_array(strtolower($name), ['accept', 'origin', 'referer', 'content-type', 'x-xsrf-token', 'x-church-id', 'x-device-id', 'x-msprout-attendance-reader'], true)) {
                    $key = strtolower($name) === 'content-type' ? 'CONTENT_TYPE' : 'HTTP_'.str_replace('-', '_', strtoupper($name));
                    $server[$key] = $value;
                }
            }
            $request = Request::create($origin.$input['path'], $input['method'], [], $input['cookies'], [], $server, $input['body'] ?? null);
            $kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
            $response = $kernel->handle($request);
            $kernel->terminate($request, $response);
            $result = ['status' => $response->getStatusCode(), 'body' => $response->getContent(), 'headers' => $response->headers->allPreserveCaseWithoutCookies(), 'cookies' => array_map(fn ($cookie) => (string) $cookie, $response->headers->getCookies())];
        } else {
            throw new RuntimeException('Unknown browser command.');
        }
        echo json_encode($result, JSON_THROW_ON_ERROR)."\n";
    } catch (Throwable $error) {
        // Never serialize exception text, request/cookie fields or credentials.
        echo json_encode(['probe_error' => get_class($error), 'location' => basename($error->getFile()).':'.$error->getLine()])."\n";
    }
}
