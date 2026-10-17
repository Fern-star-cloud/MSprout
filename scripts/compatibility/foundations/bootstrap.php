<?php

declare(strict_types=1);

// Deliberately before Laravel and the credential-rotating repository test bootstrap.
if (getenv('P1_ISOLATED') !== 'yes' || getenv('APP_ENV') !== 'testing'
    || getenv('DB_HOST') !== '127.0.0.1' || getenv('DB_PORT') !== '5432'
    || getenv('DB_URL') !== '' || getenv('DATABASE_URL') !== ''
    || (file_exists('/work/.env') && (is_link('/work/.env') || filesize('/work/.env') !== 0))
    || ! preg_match('/\Ap1_[a-f0-9]{10}_test\z/', (string) getenv('P1_DATABASE'))
    || getenv('DB_TEST_DATABASE') !== getenv('P1_DATABASE')
    || getenv('DB_TEST_RUNTIME_USERNAME') !== getenv('P1_RUNTIME')
    || getenv('P1_RUNTIME') === getenv('P1_SETUP')
    || ! preg_match('/\Ap1_runtime_[a-f0-9]{10}\z/', (string) getenv('P1_RUNTIME'))
    || getenv('DB_MIGRATION_USERNAME') !== getenv('P1_SETUP')) {
    throw new RuntimeException('Foundation guard refused database bootstrap.');
}
$setup = new PDO('pgsql:host=127.0.0.1;port=5432;dbname=p1_setup', getenv('P1_SETUP'), getenv('DB_MIGRATION_PASSWORD'), [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$setup->beginTransaction();
$setup->exec('SET TRANSACTION READ ONLY');
$identity = $setup->query("SELECT system_identifier::text AS id, current_database() AS db, current_user AS actor, current_setting('server_version_num')::int AS version FROM pg_control_system()")->fetch(PDO::FETCH_ASSOC);
if ($identity['id'] !== getenv('P1_SYSTEM_ID') || $identity['db'] !== 'p1_setup' || $identity['actor'] !== getenv('P1_SETUP') || $identity['version'] < 180000 || $identity['version'] >= 190000) {
    throw new RuntimeException('Foundation independent server identity mismatch.');
}
$setup->rollBack();
$setup = null;
if (in_array('--probe', $argv ?? [], true)) {
    echo json_encode(['verifiedBeforeBootstrap' => true, 'systemId' => $identity['id'], 'setupRole' => $identity['actor'], 'database' => getenv('P1_DATABASE')], JSON_THROW_ON_ERROR)."\n";

    return;
}
// Empty, locally generated fixture only: avoids dotenv's missing-file warning.
// Never copy an environment file or put connection settings/credentials in it.
if (! file_exists('/work/.env')) {
    file_put_contents('/work/.env', '');
}
require '/work/tests/bootstrap.php';
if (getenv('DB_DATABASE') !== getenv('P1_DATABASE') || getenv('DB_USERNAME') !== getenv('P1_RUNTIME')) {
    throw new RuntimeException('Foundation runtime configuration mismatch.');
}
putenv('P1_ROLE_INITIALIZED=yes');
