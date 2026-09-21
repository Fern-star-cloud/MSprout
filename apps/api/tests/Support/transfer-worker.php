<?php

// Isolated process used only by the real PostgreSQL concurrency regression test.
require dirname(__DIR__, 2).'/vendor/autoload.php';

use App\Actions\Memberships\TransferOwnership;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

try {
    $input = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
    $app = require dirname(__DIR__, 2).'/bootstrap/app.php';
    $app->make(Kernel::class)->bootstrap();
    config(['database.default' => 'pgsql', 'database.connections.pgsql' => $input['connection'], 'app.key' => $input['key'], 'cache.default' => 'array', 'logging.default' => 'null']);
    DB::purge('pgsql');
    DB::selectOne("SELECT set_config('application_name', ?, false)", [$input['label']]);
    Auth::guard('web')->setUser(User::findOrFail($input['user_id']));
    app(TenantContext::class)->run($input['church_id'], fn () => app(TransferOwnership::class)->handle($input['target_id'], $input['password'], $input['code']));
    echo 'transferred';
} catch (HttpExceptionInterface $exception) {
    echo $exception->getStatusCode() === 403 ? 'denied' : 'unexpected-status';
} catch (Throwable $exception) {
    echo 'failed:'.get_class($exception);
}
