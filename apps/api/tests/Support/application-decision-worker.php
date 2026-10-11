<?php

// Real concurrency probe for the isolated PostgreSQL test database only.
require dirname(__DIR__, 2).'/vendor/autoload.php';

use App\Actions\Applications\ApproveChurchApplication;
use App\Actions\Applications\RejectChurchApplication;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\HttpException;

try {
    if (getenv('APP_ENV') !== 'testing') {
        throw new RuntimeException('Test environment required');
    }
    $input = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
    $app = require dirname(__DIR__, 2).'/bootstrap/app.php';
    $app->make(Kernel::class)->bootstrap();
    config(['database.default' => 'pgsql', 'database.connections.pgsql' => $input['connection'], 'app.key' => $input['key'], 'queue.default' => 'database', 'mail.default' => 'array', 'logging.default' => 'null']);
    DB::purge('pgsql');
    DB::selectOne("SELECT set_config('application_name', ?, false)", [$input['label']]);
    $result = $input['decision'] === 'approve'
        ? app(ApproveChurchApplication::class)->handle($input['application_id'], $input['actor_id'], $input['correlation_id'])
        : app(RejectChurchApplication::class)->handle($input['application_id'], $input['actor_id'], $input['correlation_id'], ['category' => 'incomplete', 'reason' => 'Synthetic incomplete application']);
    echo $result->status->value;
} catch (HttpException $exception) {
    echo $exception->getStatusCode() === 409 ? 'stale' : 'denied';
} catch (Throwable $exception) {
    // Do not disclose input, credentials or arbitrary exception messages.
    echo 'failed:'.get_class($exception);
}
