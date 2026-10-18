<?php

// Isolated process used only by the real PostgreSQL concurrency regression test.
require dirname(__DIR__, 2).'/vendor/autoload.php';

use App\Actions\Memberships\TransferOwnership;
use App\Domain\Sync\ChurchCoordination;
use App\Models\User;
use App\Support\Auth\DatabaseSessionAuthority;
use App\Support\Tenancy\TenantContext;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

try {
    $input = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
    $connection = $input['connection'];
    if (getenv('APP_ENV') !== 'testing' || $connection['database'] !== getenv('DB_TEST_DATABASE')
        || $connection['database'] !== getenv('DB_DATABASE') || $connection['username'] !== getenv('DB_TEST_RUNTIME_USERNAME')
        || $connection['username'] !== getenv('DB_USERNAME') || ! empty($connection['url'])) {
        throw new RuntimeException('Transfer worker refuses an unverified test target.');
    }
    if (getenv('PC_ROLE_INITIALIZED') === 'yes') {
        $argv = ['transfer-worker', '--probe'];
        ob_start();
        require '/proofs/bootstrap.php';
        ob_end_clean();
    }
    $app = require dirname(__DIR__, 2).'/bootstrap/app.php';
    $app->make(Kernel::class)->bootstrap();
    config(['database.default' => 'pgsql', 'database.connections.pgsql' => $connection, 'app.key' => $input['key'],
        'cache.default' => 'array', 'logging.default' => 'null', 'session.driver' => 'database', 'session.connection' => 'pgsql']);
    DB::purge('pgsql');
    DB::selectOne("SELECT set_config('application_name', ?, false)", [$input['label']]);
    $actor = User::findOrFail($input['user_id']);
    Auth::guard('web')->setUser($actor);
    // Explicit one-time domain fixture; never automatically resurrected between requests.
    $session = app('session')->driver();
    $session->setId(Str::random(40));
    DB::table('sessions')->insert(['id' => $session->getId(), 'user_id' => $actor->id, 'last_activity' => time(),
        'payload' => base64_encode(DatabaseSessionAuthority::encode([Auth::guard('web')->getName() => $actor->id, 'church_mfa_user_id' => $actor->id]))]);
    $session->start();
    $request = Request::create('http://localhost/api/ownership-transfer', 'POST', ['target_membership_id' => $input['target_id']]);
    $request->setLaravelSession($session);
    $request->setUserResolver(fn () => $actor);
    $app->instance('request', $request);
    app(TenantContext::class)->run($input['church_id'], fn () => app(ChurchCoordination::class)->run($request,
        fn () => app(TransferOwnership::class)->handle($input['target_id'], $input['password'], $input['code'])));
    echo 'transferred';
} catch (AuthorizationException|AuthenticationException) {
    echo 'denied';
} catch (HttpExceptionInterface $exception) {
    echo $exception->getStatusCode() === 403 ? 'denied' : 'unexpected-status';
} catch (Throwable $exception) {
    echo 'failed:'.get_class($exception);
}
