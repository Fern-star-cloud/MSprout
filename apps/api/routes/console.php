<?php

use App\Jobs\PruneOperationalData;
use App\Jobs\PurgeRevokedDeviceData;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Schedule::command('birthdays:dispatch-due')->everyMinute()->withoutOverlapping();
Schedule::command('operations:scheduler-heartbeat')->everyMinute()->withoutOverlapping();
Schedule::job(new PruneOperationalData)->dailyAt('02:15')->withoutOverlapping();
Schedule::job(new PurgeRevokedDeviceData)->dailyAt('02:45')->withoutOverlapping();

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');
