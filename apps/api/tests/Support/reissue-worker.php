<?php

// Isolated PostgreSQL concurrency proof; credentials are read only from stdin.
require dirname(__DIR__, 2).'/vendor/autoload.php';

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

try {
    $input = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
    $app = require dirname(__DIR__, 2).'/bootstrap/app.php';
    $app->make(Kernel::class)->bootstrap();
    config(['database.default' => 'pgsql', 'database.connections.pgsql' => $input['connection'], 'app.key' => $input['key'], 'cache.default' => 'array', 'logging.default' => 'null', 'mail.default' => 'array', 'queue.default' => 'database', 'queue.connections.database.connection' => 'pgsql']);
    DB::purge('pgsql');
    DB::selectOne("SELECT set_config('application_name', ?, false)", [$input['label']]);
    echo Artisan::call('platform:reissue-admin-setup', ['--handle' => 'sage.dev']) === 0 ? 'reissued' : 'denied';
} catch (Throwable) {
    echo 'failed';
}
