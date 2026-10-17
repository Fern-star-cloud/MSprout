<?php

declare(strict_types=1);
use App\Domain\Sync\ChurchCoordination;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

if (getenv('P1_ROLE_INITIALIZED') !== 'yes' || getenv('DB_DATABASE') !== getenv('P1_DATABASE') || getenv('DB_USERNAME') !== getenv('P1_RUNTIME')) {
    throw new RuntimeException('Coordination worker refuses uninitialized configuration.');
}
$argv = ['worker', '--probe'];
ob_start();
require '/proofs/bootstrap.php';
ob_end_clean();
require '/work/vendor/autoload.php';
$app = require '/work/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$app->instance('request', Request::create('http://localhost/'));
$input = json_decode((string) fgets(STDIN), true, 512, JSON_THROW_ON_ERROR);
$actor = User::findOrFail($input['actor']);
Auth::guard('web')->setUser($actor);
$request = Request::create('http://localhost/');
$request->setUserResolver(fn () => $actor);
$request->setLaravelSession($app->make('session.store'));
if ($input['mfa'] ?? false) {
    $request->session()->put('church_mfa_user_id', $actor->id);
}
try {
    $result = app(TenantContext::class)->run($input['church'], function () use ($input, $request) {
        $pid = DB::scalar('SELECT pg_backend_pid()');
        echo json_encode(['phase' => 'context', 'pid' => $pid], JSON_THROW_ON_ERROR)."\n";
        if (trim((string) fgets(STDIN)) !== 'enter') {
            throw new RuntimeException('Missing worker barrier');
        }
        if ($input['timeout'] ?? false) {
            DB::statement("SET LOCAL lock_timeout='300ms'");
        }

        return app(ChurchCoordination::class)->run($request, function () use ($input, $pid) {
            echo json_encode(['phase' => 'acquired', 'pid' => $pid], JSON_THROW_ON_ERROR)."\n";
            $finish = trim((string) fgets(STDIN));
            if ($finish === 'rollback') {
                throw new RuntimeException('Deliberate fixture rollback');
            }
            if ($finish !== 'commit') {
                throw new RuntimeException('Missing completion barrier');
            }
            if ($input['lockActor'] ?? false) {
                DB::table('users')->where('id', $input['actor'])->lockForUpdate()->first();
            }

            return ['phase' => 'committed'];
        }, $input['ministry'] ?? null);
    });
    echo json_encode($result, JSON_THROW_ON_ERROR)."\n";
} catch (Throwable $error) {
    echo json_encode(['phase' => 'refused', 'type' => get_class($error), 'code' => (string) $error->getCode()], JSON_THROW_ON_ERROR)."\n";
}
