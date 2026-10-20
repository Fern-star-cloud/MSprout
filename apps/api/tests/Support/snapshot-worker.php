<?php

declare(strict_types=1);

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Tests\Support\IntegrationScenario;

$argv = ['snapshot-worker', '--probe'];
ob_start();
require '/proofs/bootstrap.php';
ob_end_clean();
require '/work/vendor/autoload.php';
$app = require '/work/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

try {
    IntegrationScenario::guard();
    if (getenv('SNAPSHOT_ISOLATED') !== 'yes') {
        throw new RuntimeException('Snapshot isolation required.');
    }
    $input = json_decode(fgets(STDIN), true, 64, JSON_THROW_ON_ERROR);
    if (! preg_match('~\A/api/(offline/bootstrap/recovery|ownership-transfer|teachers/[a-f0-9-]{36}/assignments|students/[a-f0-9-]{36}|imports/[a-f0-9-]{36}/commit)\z~', $input['path'])) {
        throw new RuntimeException('Unsupported isolated worker request.');
    }
    config(['recovery.enabled' => true, 'synchronization.coordinated_publication' => true, 'session.driver' => 'database', 'session.connection' => 'pgsql', 'logging.default' => 'null']);
    echo json_encode(['ready' => true, 'pid' => (int) DB::scalar('SELECT pg_backend_pid()')])."\n";
    if (trim((string) fgets(STDIN)) !== 'enter') {
        exit;
    }
    $server = ['HTTP_ACCEPT' => 'application/json', 'HTTP_ORIGIN' => config('app.url'), 'HTTP_X_CHURCH_ID' => $input['church'], 'CONTENT_TYPE' => 'application/json'];
    if (isset($input['cookies']['XSRF-TOKEN'])) {
        $server['HTTP_X_XSRF_TOKEN'] = $input['cookies']['XSRF-TOKEN'];
    }
    $request = Request::create('http://localhost'.$input['path'], $input['method'] ?? 'POST', [], $input['cookies'], [], $server, json_encode($input['body'], JSON_THROW_ON_ERROR));
    $kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
    $response = $kernel->handle($request);
    $body = json_decode($response->getContent(), true);
    // No cookie, credential, raw original, or child payload in worker diagnostics.
    $summary = is_array($body) ? array_intersect_key($body, array_flip(['code', 'recovery_id', 'generation', 'state', 'snapshot_cursor', 'manifest_digest', 'input_page_count', 'input_item_count', 'output_page_count', 'output_item_count', 'expires_at', 'coverage_epoch', 'window_start', 'window_end', 'timezone'])) : [];
    $kernel->terminate($request, $response);
    echo json_encode(['status' => $response->getStatusCode(), 'result' => $summary], JSON_THROW_ON_ERROR)."\n";
} catch (Throwable $error) {
    echo json_encode(['error' => get_class($error)])."\n";
    exit(1);
}
