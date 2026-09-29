<?php

namespace App\Console\Commands;

use App\Jobs\DispatchBirthdayNotifications;
use App\Support\Tenancy\TenantContext;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class DispatchDueBirthdayNotifications extends Command
{
    protected $signature = 'birthdays:dispatch-due';

    protected $description = 'Queue privacy-safe birthday reminders for churches at 8:00 AM local time';

    public function handle(TenantContext $tenancy): int
    {
        $now = CarbonImmutable::now('UTC')->startOfMinute();
        $churches = DB::select('SELECT church_id, local_date::text AS local_date FROM due_birthday_churches(?)', [$now]);
        foreach ($churches as $church) {
            $tenancy->runForSystem($church->church_id, function () use ($church, $now): void {
                $inserted = DB::table('birthday_notification_dispatches')->insertOrIgnore([
                    'id' => (string) Str::uuid(),
                    'church_id' => $church->church_id,
                    'local_date' => $church->local_date,
                    'dispatched_at' => $now,
                ]);
                if ($inserted === 1) {
                    // The database-backed queue row and dispatch marker commit together.
                    DispatchBirthdayNotifications::dispatch($church->church_id, $church->local_date);
                }
            });
        }

        return self::SUCCESS;
    }
}
