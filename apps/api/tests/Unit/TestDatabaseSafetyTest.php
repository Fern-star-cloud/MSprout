<?php

use Symfony\Component\Process\Process;

it('rejects unsafe test infrastructure before opening a database connection', function (array $unsafe, string $message) {
    $process = new Process([PHP_BINARY, dirname(__DIR__).'/bootstrap.php'], null, array_merge([
        'DB_HOST' => '127.0.0.1',
        'DB_PORT' => '1',
        'DB_DATABASE' => 'ministrysprout',
        'DB_MIGRATION_DATABASE' => 'ministrysprout',
        'DB_MIGRATION_USERNAME' => 'ministrysprout',
        'DB_MIGRATION_PASSWORD' => 'nonsecret-test-placeholder',
        'DB_RUNTIME_USERNAME' => 'ministrysprout_runtime',
        'DB_TEST_RUNTIME_USERNAME' => 'ministrysprout_runtime_test',
        'DB_TEST_DATABASE' => 'ministrysprout_test',
    ], $unsafe));
    $process->run();

    expect($process->isSuccessful())->toBeFalse()
        ->and($process->getErrorOutput().$process->getOutput())->toContain($message)
        ->not->toContain('Connection refused');
})->with([
    'development database' => [['DB_TEST_DATABASE' => 'ministrysprout'], 'The test database must be separate from development and migration databases.'],
    'migration database' => [['DB_MIGRATION_DATABASE' => 'migration_data', 'DB_TEST_DATABASE' => 'migration_data'], 'The test database must be separate from development and migration databases.'],
    'development runtime role' => [['DB_TEST_RUNTIME_USERNAME' => 'ministrysprout_runtime'], 'The test runtime role must be separate from the development runtime role.'],
]);
