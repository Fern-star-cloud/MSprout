<?php

declare(strict_types=1);

// Independent guard precedes autoload and Laravel; workers never rotate roles/bootstrap schema.
if (getenv('PC_ROLE_INITIALIZED') !== 'yes') {
    throw new RuntimeException('Uninitialized authority worker.');
}
$argv = ['worker', '--probe'];
ob_start();
require '/proofs/bootstrap.php';
ob_end_clean();
require dirname(__DIR__, 2).'/vendor/autoload.php';

use App\Domain\Sync\ChurchCoordination;
use App\Models\User;
use App\Support\Auth\DatabaseSessionAuthority;
use App\Support\Auth\UserAuthorityLocks;
use App\Support\Tenancy\TenantContext;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Tests\Support\AuthorityScenario;

$input = json_decode((string) fgets(STDIN), true, 512, JSON_THROW_ON_ERROR);
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
AuthorityScenario::guard();
config(['session.driver' => 'database', 'session.connection' => 'pgsql', 'logging.default' => 'null']);
DB::statement("SET statement_timeout='15s'");
$smtp = null;
$ready = ['phase' => 'ready', 'pid' => (int) DB::scalar('SELECT pg_backend_pid()')];
if ($input['mode'] === 'smtp') {
    $smtp = stream_socket_server('tcp://127.0.0.1:0', $code, $error);
    if ($smtp === false) {
        throw new RuntimeException('Isolated SMTP unavailable.');
    }
    $ready['port'] = (int) substr(strrchr(stream_socket_get_name($smtp, false), ':'), 1);
}
echo json_encode($ready)."\n";
if (trim((string) fgets(STDIN)) !== 'enter') {
    throw new RuntimeException('Missing authority barrier.');
}
try {
    $mode = $input['mode'];
    if ($mode === 'smtp') {
        $client = stream_socket_accept($smtp, 10);
        if ($client === false) {
            throw new RuntimeException('Isolated SMTP connection absent.');
        }
        stream_set_timeout($client, 10);
        fwrite($client, "220 isolated.example.test ESMTP\r\n");
        $data = false;
        while (($line = fgets($client)) !== false) {
            if ($data) {
                if ($line !== ".\r\n") {
                    continue;
                }
                // Discard raw proof mail; only the protocol barrier leaves the process.
                echo json_encode(['phase' => 'data_received'])."\n";
                $accept = trim((string) fgets(STDIN)) === 'accept';
                fwrite($client, $accept ? "250 accepted\r\n" : "550 synthetic refusal\r\n");
                $data = false;
            } elseif (str_starts_with($line, 'EHLO') || str_starts_with($line, 'HELO')) {
                fwrite($client, "250 isolated.example.test\r\n");
            } elseif (str_starts_with($line, 'DATA')) {
                fwrite($client, "354 continue\r\n");
                $data = true;
            } elseif (str_starts_with($line, 'QUIT')) {
                fwrite($client, "221 bye\r\n");
                break;
            } else {
                fwrite($client, "250 ok\r\n");
            }
        }
        fclose($client);
        fclose($smtp);
        echo json_encode(['phase' => 'smtp_closed'])."\n";
        exit;
    }
    if ($mode === 'http') {
        $app->instance('env', 'local');
        if (isset($input['smtpPort'])) {
            if (! is_int($input['smtpPort']) || $input['smtpPort'] < 1024 || $input['smtpPort'] > 65535) {
                throw new RuntimeException('Foreign SMTP target.');
            }
            config(['mail.default' => 'pc_smtp', 'mail.mailers.pc_smtp' => ['transport' => 'smtp', 'scheme' => 'smtp', 'host' => '127.0.0.1', 'port' => $input['smtpPort'], 'auto_tls' => false, 'timeout' => 10]]);
        }
        if (isset($input['clockKey'])) {
            Carbon::setTestNow(fn () => new DateTimeImmutable('@'.(int) DB::table('cache')->where('key', $input['clockKey'])->value('value')));
        }
        $server = ['HTTP_ACCEPT' => 'application/json', 'HTTP_ORIGIN' => config('app.url'), 'HTTP_X_CHURCH_ID' => $input['church']];
        if (isset($input['cookies']['XSRF-TOKEN'])) {
            $server['HTTP_X_XSRF_TOKEN'] = $input['cookies']['XSRF-TOKEN'];
        }
        foreach ($input['headers'] ?? [] as $name => $value) {
            if (! in_array($name, ['X-Device-Id'], true)) {
                throw new RuntimeException('Unknown worker header.');
            }
            $server['HTTP_'.str_replace('-', '_', strtoupper($name))] = $value;
        }
        $request = Request::create('http://localhost'.$input['path'], $input['method'] ?? 'GET', [], $input['cookies'], [], $server, isset($input['body']) ? json_encode($input['body']) : null);
        if (isset($input['body'])) {
            $request->headers->set('Content-Type', 'application/json');
        }
        $kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
        $response = $kernel->handle($request);
        echo json_encode(['phase' => 'http', 'status' => $response->getStatusCode()])."\n";
        $kernel->terminate($request, $response);
        exit;
    }
    if ($mode === 'coordinate') {
        $actor = User::findOrFail($input['actor']);
        Auth::guard('web')->setUser($actor);
        $session = app('session')->driver();
        $session->setId($input['session']);
        $session->start();
        $request = Request::create('http://localhost/');
        $request->setLaravelSession($session);
        $request->setUserResolver(fn () => $actor);
        app(TenantContext::class)->run($input['church'], fn () => app(ChurchCoordination::class)->run($request, function ($member, $fresh, $context): void {
            $context->assertUsable();
            echo json_encode(['phase' => 'authorized'])."\n";
            if (trim((string) fgets(STDIN)) !== 'commit') {
                throw new RuntimeException('Missing coordination completion barrier.');
            }
        }));
        echo json_encode(['phase' => 'committed'])."\n";
        exit;
    }
    if ($mode === 'users') {
        app(UserAuthorityLocks::class)->run($input['participants'], function (): void {
            echo json_encode(['phase' => 'users_locked'])."\n";
            if (trim((string) fgets(STDIN)) !== 'commit') {
                throw new RuntimeException('Missing User lock completion barrier.');
            }
        });
        echo json_encode(['phase' => 'committed'])."\n";
        exit;
    }
    app(UserAuthorityLocks::class)->run([$input['actor'] => $mode === 'hold' ? 'read' : 'write'], function ($actors) use ($input, $mode): void {
        if ($mode === 'delete') {
            DB::table('sessions')->where('id', $input['session'])->delete();
        } elseif ($mode === 'hold') {
            $actor = $actors[$input['actor']];
            Auth::guard('web')->setUser($actor);
            $session = app('session')->driver();
            $session->setId($input['session']);
            $session->start();
            $request = Request::create('http://localhost/auth/session');
            $request->setLaravelSession($session);
            $request->setUserResolver(fn () => $actor);
            app(DatabaseSessionAuthority::class)->validate($request, $actor);
        } else {
            throw new RuntimeException('Unknown authority worker operation.');
        }
        echo json_encode(['phase' => $mode === 'hold' ? 'authorized' : 'deleted'])."\n";
        if (trim((string) fgets(STDIN)) !== 'commit') {
            throw new RuntimeException('Missing completion barrier.');
        }
    });
    echo json_encode(['phase' => 'committed'])."\n";
} catch (AuthenticationException) {
    echo json_encode(['phase' => 'denied'])."\n";
} catch (Throwable $exception) {
    // No exception messages/arguments, payloads or credentials in worker output.
    echo json_encode(['phase' => 'failed', 'type' => get_class($exception)])."\n";
    exit(1);
}
