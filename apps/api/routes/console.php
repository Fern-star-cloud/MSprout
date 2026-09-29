<?php

use App\Jobs\PurgeRejectedApplications;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Schedule::job(new PurgeRejectedApplications)->daily()->withoutOverlapping();
Schedule::command('birthdays:dispatch-due')->everyMinute()->withoutOverlapping();

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');
