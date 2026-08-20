<?php

declare(strict_types=1);

require dirname(__DIR__).'/vendor/autoload.php';

use Dotenv\Dotenv;

$localEnvironment = Dotenv::createArrayBacked(dirname(__DIR__))->safeLoad();

$setting = static function (string $name, ?string $fallback = null) use ($localEnvironment): ?string {
    $value = getenv($name);

    if (is_string($value) && $value !== '') {
        return $value;
    }

    $localValue = $localEnvironment[$name] ?? null;

    return is_string($localValue) && $localValue !== '' ? $localValue : $fallback;
};

$setEnvironment = static function (string $name, string $value): void {
    putenv("{$name}={$value}");
    $_ENV[$name] = $value;
    $_SERVER[$name] = $value;
};

if (! extension_loaded('pdo_pgsql')) {
    throw new RuntimeException('The PostgreSQL PDO extension is required for the API test suite.');
}

$host = $setting('DB_HOST', '127.0.0.1');
$port = $setting('DB_PORT', '5432');
$adminDatabase = $setting('DB_MIGRATION_DATABASE', $setting('DB_DATABASE', 'ministrysprout'));
$adminUsername = $setting('DB_MIGRATION_USERNAME', $setting('DB_USERNAME', 'ministrysprout'));
$adminPassword = $setting('DB_MIGRATION_PASSWORD', $setting('DB_PASSWORD'));
$runtimeUsername = $setting('DB_RUNTIME_USERNAME', 'ministrysprout_runtime');
$testDatabase = $setting('DB_TEST_DATABASE', 'ministrysprout_test');
$runtimePassword = bin2hex(random_bytes(32));

foreach ([$adminDatabase, $adminUsername, $runtimeUsername, $testDatabase] as $identifier) {
    if (! is_string($identifier) || preg_match('/\A[a-z_][a-z0-9_]*\z/', $identifier) !== 1) {
        throw new RuntimeException('PostgreSQL test identifiers must use lowercase letters, digits, and underscores.');
    }
}

if (! is_string($adminPassword) || $adminPassword === '') {
    throw new RuntimeException('A local PostgreSQL migration password is required to prepare the test database.');
}

$admin = new PDO(
    "pgsql:host={$host};port={$port};dbname=postgres",
    $adminUsername,
    $adminPassword,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION],
);

$serverVersion = (int) $admin->query('SHOW server_version_num')->fetchColumn();

if ($serverVersion < 180000 || $serverVersion >= 190000) {
    throw new RuntimeException('The API test suite requires PostgreSQL 18.x.');
}

$quoteIdentifier = static fn (string $identifier): string => '"'.str_replace('"', '""', $identifier).'"';
$runtimeRole = $quoteIdentifier($runtimeUsername);

$roleStatement = $admin->prepare('SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :role)');
$roleStatement->execute(['role' => $runtimeUsername]);

if (! (bool) $roleStatement->fetchColumn()) {
    $admin->exec("CREATE ROLE {$runtimeRole} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS");
}

$admin->exec(
    "ALTER ROLE {$runtimeRole} WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD ".
    $admin->quote($runtimePassword),
);

$databaseStatement = $admin->prepare('SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = :database)');
$databaseStatement->execute(['database' => $testDatabase]);

if (! (bool) $databaseStatement->fetchColumn()) {
    $admin->exec(
        'CREATE DATABASE '.$quoteIdentifier($testDatabase).' OWNER '.$quoteIdentifier($adminUsername),
    );
}

$admin = null;

foreach ([
    'DB_CONNECTION' => 'pgsql',
    'DB_HOST' => (string) $host,
    'DB_PORT' => (string) $port,
    'DB_DATABASE' => $testDatabase,
    'DB_USERNAME' => $runtimeUsername,
    'DB_PASSWORD' => $runtimePassword,
    'DB_RUNTIME_USERNAME' => $runtimeUsername,
    'DB_MIGRATION_CONNECTION' => 'pgsql_migration',
    'DB_MIGRATION_DATABASE' => $testDatabase,
    'DB_MIGRATION_USERNAME' => $adminUsername,
    'DB_MIGRATION_PASSWORD' => $adminPassword,
] as $name => $value) {
    $setEnvironment($name, $value);
}
