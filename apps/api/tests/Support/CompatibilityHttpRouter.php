<?php

use App\Domain\Attendance\AttendanceCompatibilityException;
use App\Models\DeviceCursor;
use App\Models\SyncEvent;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;

// Test-only PHP server entry point. Never registered by application routes.
if (getenv('B3_TEST_HTTP') !== 'isolated' || getenv('APP_ENV') !== 'local'
    || ! preg_match('/\A[a-z0-9_]+_test\z/', (string) getenv('DB_TEST_DATABASE'))
    || getenv('DB_DATABASE') !== getenv('DB_TEST_DATABASE')
    || getenv('DB_MIGRATION_DATABASE') !== getenv('DB_TEST_DATABASE')
    || getenv('DB_USERNAME') !== getenv('DB_TEST_RUNTIME_USERNAME')
    || ! in_array(getenv('DB_HOST'), ['127.0.0.1', 'localhost'], true)
    || getenv('DB_URL') !== '') {
    throw new RuntimeException('Refusing non-isolated compatibility HTTP bootstrap.');
}
require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();
if (getenv('B3_TEST_HTTP') !== 'isolated' || ! $app->environment('local')
    || ! preg_match('/\A[a-z0-9_]+_test\z/', (string) getenv('DB_TEST_DATABASE'))
    || config('database.connections.pgsql.database') !== getenv('DB_TEST_DATABASE')
    || config('database.connections.pgsql.username') !== getenv('DB_TEST_RUNTIME_USERNAME')
    || ! in_array(config('database.connections.pgsql.host'), ['127.0.0.1', 'localhost'], true)) {
    throw new RuntimeException('Refusing non-isolated compatibility HTTP test server.');
}
if (getenv('B3_HTTP_FAULT') === 'cursor') {
    DeviceCursor::created(function (): void {
        throw new AttendanceCompatibilityException;
    });
}
if (getenv('B3_HTTP_FAULT') === 'receipt') {
    SyncEvent::created(function (): void {
        throw new AttendanceCompatibilityException;
    });
}
$request = Request::capture();
$response = $kernel->handle($request);
$response->send();
$kernel->terminate($request, $response);
