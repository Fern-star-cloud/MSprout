<?php

declare(strict_types=1);
use App\Domain\Attendance\PublishAttendanceChange;
use App\Models\AttendanceSession;
use App\Models\ChangeFeedEntry;
use App\Models\Church;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Support\Facades\DB;

if (getenv('P1_ISOLATED') !== 'yes' || getenv('P1_ROLE_INITIALIZED') !== 'yes' || getenv('DB_DATABASE') !== getenv('P1_DATABASE') || getenv('DB_USERNAME') !== getenv('P1_RUNTIME') || getenv('DB_HOST') !== '127.0.0.1' || getenv('DB_URL') !== '' || file_exists('/work/.env')) {
    throw new RuntimeException('Worker refused non-isolated configuration');
}
require '/work/vendor/autoload.php';
$app = require '/work/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$connection = DB::selectOne('SELECT current_database() AS db, current_user AS actor, host(inet_server_addr()) AS address, inet_server_port() AS port');
if ($connection->db !== getenv('P1_DATABASE') || $connection->actor !== getenv('P1_RUNTIME') || ! in_array($connection->address, ['127.0.0.1', '::1'], true) || (int) $connection->port !== 5432) {
    throw new RuntimeException('Worker runtime connection identity mismatch');
}
try {
    $input = json_decode((string) fgets(STDIN), true, 512, JSON_THROW_ON_ERROR);
    DB::beginTransaction();
    $church = $input['church'] ?? '00000000-0000-4000-8000-000000000010';
    if (! in_array($church, ['00000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000110'], true)) {
        throw new RuntimeException('Non-fixture church');
    }
    DB::selectOne("SELECT set_config('app.current_church_id', ?, true)", [$church]);
    if ($input['coordinated'] ?? false) {
        $pid = DB::selectOne('SELECT pg_backend_pid() AS pid')->pid;
        echo json_encode(['phase' => 'before-church-lock', 'pid' => $pid], JSON_THROW_ON_ERROR)."\n";
        if (trim((string) fgets(STDIN)) !== 'enter') {
            throw new RuntimeException('Lock barrier not released');
        }
        // Test-only ordering control. No production method is patched.
        Church::query()->whereKey($church)->lockForUpdate()->firstOrFail();
    }
    $session = AttendanceSession::query()->lockForUpdate()->findOrFail($input['session']);
    $session->forceFill(['version' => $session->version + 1])->save();
    app(PublishAttendanceChange::class)->handle($session);
    $sequence = ChangeFeedEntry::query()->max('sequence');
    $id = DB::selectOne('SELECT pg_backend_pid() AS pid, pg_current_xact_id()::text AS tx');
    echo json_encode(['sequence' => (int) $sequence, 'backend' => $id, 'phase' => 'allocated-uncommitted'], JSON_THROW_ON_ERROR)."\n";
    if (trim((string) fgets(STDIN)) !== 'commit') {
        throw new RuntimeException('Commit barrier not released');
    }
    DB::commit();
    echo json_encode(['phase' => 'committed', 'sequence' => (int) $sequence], JSON_THROW_ON_ERROR)."\n";
} catch (Throwable $error) {
    if (DB::transactionLevel()) {
        DB::rollBack();
    }
    echo json_encode(['error' => get_class($error), 'phase' => 'worker-failed'])."\n";
    exit(1);
}
