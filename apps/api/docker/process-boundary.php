<?php

declare(strict_types=1);

// Runs before Laravel/config caching. A flag is routing, never database authority.
$mode = $argv[1] ?? '';
$secret = '/run/secrets/msprout-maintenance-password';
$maintenance = getenv('DB_MAINTENANCE_USERNAME');
$runtime = getenv('DB_RUNTIME_USERNAME');
$user = getenv('DB_USERNAME');
$fail = static function (): never {
    fwrite(STDERR, "Database process isolation configuration rejected.\n");
    exit(78);
};
if ($mode === 'maintenance') {
    if (! $maintenance || ! $runtime || $maintenance === $runtime || $user !== $maintenance
        || ! is_readable($secret) || trim((string) file_get_contents($secret)) === ''
        || getenv('DB_PASSWORD') || getenv('DB_URL') || getenv('DATABASE_URL')
        || getenv('DB_MIGRATION_PASSWORD') || getenv('DB_MIGRATION_USERNAME')) {
        $fail();
    }
} elseif ($mode !== 'migrate') {
    if (($maintenance && $user === $maintenance) || getenv('MSPROUT_MAINTENANCE_PROCESS')
        || is_readable($secret) || getenv('DB_MAINTENANCE_PASSWORD')
        || getenv('DB_MIGRATION_PASSWORD') || getenv('DB_MIGRATION_USERNAME')) {
        $fail();
    }
}
