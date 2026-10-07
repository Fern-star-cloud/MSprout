<?php

use App\Models\PlatformAdmin;
use GuzzleHttp\Client;
use GuzzleHttp\Cookie\CookieJar;
use GuzzleHttp\Exception\ConnectException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Fortify\Fortify;
use PragmaRX\Google2FA\Google2FA;
use Symfony\Component\Process\Process;
use Tests\Support\PostgresTestDatabase;

beforeEach(function () {
    PostgresTestDatabase::refresh();
});

it('persists platform authentication through real artisan serve HTTP boots with database sessions selected before boot', function (bool $encrypted) {
    $password = Str::password(32);
    $secret = (new Google2FA)->generateSecretKey();
    $admin = PlatformAdmin::factory()->create([
        'status' => 'active', 'password' => $password, 'email_verified_at' => now(),
        'two_factor_secret' => Fortify::currentEncrypter()->encrypt($secret),
        'two_factor_confirmed_at' => now(), 'recovery_codes_acknowledged_at' => now(),
    ]);
    $socket = stream_socket_server('tcp://127.0.0.1:0');
    if ($socket === false) {
        throw new RuntimeException('Unable to reserve an isolated HTTP test port.');
    }
    $address = stream_socket_get_name($socket, false);
    fclose($socket);
    $port = (int) substr($address, strrpos($address, ':') + 1);
    // The protected test bootstrap supplies the isolated database and restricted test role.
    // --no-reload retains that environment in Laravel's child server instead of reloading live .env values.
    $server = new Process([
        PHP_BINARY, 'artisan', 'serve', '--host=127.0.0.1', '--port='.$port, '--tries=1', '--no-reload',
    ], base_path(), array_merge(getenv(), [
        'APP_ENV' => 'local', 'APP_DEBUG' => 'false', 'APP_KEY' => config('app.key'),
        // Match the verified uncached local runtime without loading any shared credential cache or URL.
        'APP_CONFIG_CACHE' => sys_get_temp_dir().'/msprout-http-config-'.Str::uuid().'.php', 'DB_URL' => '',
        'SESSION_DRIVER' => 'database', 'SESSION_CONNECTION' => 'pgsql',
        'SESSION_ENCRYPT' => $encrypted ? 'true' : 'false',
        'CACHE_STORE' => 'array', 'MAIL_MAILER' => 'array', 'QUEUE_CONNECTION' => 'sync',
    ]));
    $server->setTimeout(30);
    $cookies = new CookieJar;
    $client = new Client([
        'base_uri' => 'http://'.$address, 'cookies' => $cookies, 'http_errors' => false,
        'timeout' => 5, 'headers' => ['Accept' => 'application/json'],
    ]);
    try {
        $server->start();
        $ready = false;
        $deadline = microtime(true) + 15;
        do {
            if (! $server->isRunning()) {
                throw new RuntimeException('The isolated HTTP test server stopped before startup.');
            }
            try {
                $ready = $client->get('/health/live')->getStatusCode() === 200;
            } catch (ConnectException) {
                usleep(50_000);
            }
        } while (! $ready && microtime(true) < $deadline);
        expect($ready)->toBeTrue();
        expect($client->get('/platform/me')->getStatusCode())->toBe(401);
        $csrf = json_decode((string) $client->get('/platform/csrf-token')->getBody(), true)['csrf_token'];
        $login = $client->post('/platform/login', [
            'headers' => ['X-CSRF-TOKEN' => $csrf],
            'json' => ['handle' => $admin->handle, 'password' => $password],
        ]);
        expect($login->getStatusCode())->toBe(200);
        expect(json_decode((string) $login->getBody(), true))->toBe(['two_factor' => true]);
        $csrf = json_decode((string) $client->get('/platform/csrf-token')->getBody(), true)['csrf_token'];
        $challenge = $client->post('/platform/two-factor-challenge', [
            'headers' => ['X-CSRF-TOKEN' => $csrf], 'json' => ['code' => (new Google2FA)->getCurrentOtp($secret)],
        ]);
        expect($challenge->getStatusCode())->toBe(204);
        $account = $client->get('/platform/me');
        expect($account->getStatusCode())->toBe(200);
        expect(json_decode((string) $account->getBody(), true))->toBe(['handle' => $admin->handle, 'online_only' => true]);
        expect($account->getHeaderLine('Cache-Control'))->toBe('no-store, private');
        expect(Str::isUuid($account->getHeaderLine('X-Correlation-Id')))->toBeTrue();
        $cookie = $cookies->getCookieByName(config('auth.platform_session_cookie'));
        expect($cookie !== null && $cookie->getPath() === '/platform' && $cookie->getHttpOnly())->toBeTrue();
        // auth:platform selects the UUID guard. A built-in handler would fail this write with 22P02.
        expect(DB::table('sessions')->exists())->toBeTrue();
        expect(DB::table('sessions')->whereNotNull('user_id')->exists())->toBeFalse();
        expect($client->get('/auth/session')->getStatusCode())->toBe(401);
    } finally {
        // Never emit process output, cookies, tokens, credential bodies or session payloads.
        $server->stop();
    }
})->with([false, true]);
