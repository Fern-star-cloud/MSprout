<?php

use App\Domain\Sync\MaintenanceCoordinator;
use App\Jobs\PruneOperationalData;
use App\Jobs\PurgeRevokedDeviceData;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

// Dedicated service owns fixed cleanup commands. Never consume the web-writable queue.
if (config('maintenance.process') === true) {
    Schedule::command('operations:maintenance prune')->dailyAt('02:15')->withoutOverlapping();
    Schedule::command('operations:maintenance purge-revoked')->dailyAt('02:45')->withoutOverlapping();
} else {
    Schedule::command('birthdays:dispatch-due')->everyMinute()->withoutOverlapping();
    Schedule::command('operations:scheduler-heartbeat')->everyMinute()->withoutOverlapping();
}

Artisan::command('operations:maintenance {task}', function (): int {
    app(MaintenanceCoordinator::class)->assertWorker();
    $job = match ($this->argument('task')) {
        'prune' => new PruneOperationalData,
        'purge-revoked' => new PurgeRevokedDeviceData,
        default => throw new InvalidArgumentException('Unsupported maintenance operation.'),
    };
    app()->call([$job, 'handle']);

    return 0;
});

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');
