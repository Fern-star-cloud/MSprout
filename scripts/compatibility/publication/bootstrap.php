<?php

declare(strict_types=1);

// Deliberately before Laravel and the credential-rotating repository test bootstrap.
if (getenv('PA_ISOLATED') !== 'yes' || getenv('APP_ENV') !== 'testing'
    || getenv('DB_HOST') !== '127.0.0.1' || getenv('DB_PORT') !== '5432'
    || getenv('DB_URL') !== '' || getenv('DATABASE_URL') !== ''
    || (file_exists('/work/.env') && (is_link('/work/.env') || filesize('/work/.env') !== 0))
    || ! preg_match('/\Apa_[a-f0-9]{10}_test\z/', (string) getenv('PA_DATABASE'))
    || getenv('DB_TEST_DATABASE') !== getenv('PA_DATABASE')
    || getenv('DB_TEST_RUNTIME_USERNAME') !== getenv('PA_RUNTIME')
    || getenv('PA_RUNTIME') === getenv('PA_SETUP')
    || ! preg_match('/\Apa_setup_[a-f0-9]{10}\z/', (string) getenv('PA_SETUP'))
    || ! preg_match('/\Apa_runtime_[a-f0-9]{10}\z/', (string) getenv('PA_RUNTIME'))
    || getenv('DB_MIGRATION_USERNAME') !== getenv('PA_SETUP')) {
    throw new RuntimeException('Publication guard refused database bootstrap.');
}
$setup = new PDO('pgsql:host=127.0.0.1;port=5432;dbname=pa_setup', getenv('PA_SETUP'), getenv('DB_MIGRATION_PASSWORD'), [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$setup->beginTransaction();
$setup->exec('SET TRANSACTION READ ONLY');
$identity = $setup->query("SELECT system_identifier::text AS id, current_database() AS db, current_user AS actor, current_setting('server_version_num')::int AS version FROM pg_control_system()")->fetch(PDO::FETCH_ASSOC);
if ($identity['id'] !== getenv('PA_SYSTEM_ID') || $identity['db'] !== 'pa_setup' || $identity['actor'] !== getenv('PA_SETUP') || $identity['version'] < 180000 || $identity['version'] >= 190000) {
    throw new RuntimeException('Publication independent server identity mismatch.');
}
$setup->rollBack();
$setup = null;
if (in_array('--probe', $argv ?? [], true)) {
    echo json_encode(['verifiedBeforeBootstrap' => true, 'systemId' => $identity['id'], 'setupRole' => $identity['actor'], 'database' => getenv('PA_DATABASE')], JSON_THROW_ON_ERROR)."\n";

    return;
}
// Empty, locally generated fixture only: avoids dotenv's missing-file warning.
// Never copy an environment file or put connection settings/credentials in it.
if (! file_exists('/work/.env')) {
    file_put_contents('/work/.env', '');
}
require '/work/tests/bootstrap.php';
if (getenv('DB_DATABASE') !== getenv('PA_DATABASE') || getenv('DB_USERNAME') !== getenv('PA_RUNTIME')) {
    throw new RuntimeException('Publication runtime configuration mismatch.');
}
putenv('PA_ROLE_INITIALIZED=yes');

// Preserve the original P2-1A worker's unmodified initialized-role guard.
putenv('P1_ROLE_INITIALIZED=yes');
putenv('P1_DATABASE='.getenv('PA_DATABASE'));
putenv('P1_RUNTIME='.getenv('PA_RUNTIME'));
