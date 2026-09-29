<?php

namespace App\Jobs;

use App\Domain\Notifications\FindBirthdayRecipients;
use App\Support\Tenancy\TenantContext;
use Carbon\CarbonImmutable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class DispatchBirthdayNotifications implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $uniqueFor = 86_400;

    public function __construct(public readonly string $churchId, public readonly string $localDate) {}

    public function uniqueId(): string
    {
        return $this->churchId.':'.$this->localDate;
    }

    public function handle(TenantContext $tenancy, FindBirthdayRecipients $finder): void
    {
        $tenancy->runForSystem($this->churchId, function () use ($finder): void {
            $date = CarbonImmutable::createFromFormat('!Y-m-d', $this->localDate, 'UTC');
            if ($date === false) {
                throw new \InvalidArgumentException('Invalid local date.');
            }
            foreach ($finder->recipients($this->churchId, $date) as $recipient) {
                $deliveryId = (string) Str::uuid();
                $inserted = DB::table('birthday_notification_deliveries')->insertOrIgnore([
                    'id' => $deliveryId,
                    'church_id' => $this->churchId,
                    'local_date' => $this->localDate,
                    'user_id' => $recipient['user_id'],
                    'membership_id' => $recipient['membership_id'],
                    'device_id' => $recipient['device_id'],
                    'push_subscription_id' => $recipient['subscription_id'],
                    'birthday_count' => $recipient['birthday_count'],
                    'status' => 'pending',
                    'attempt_count' => 0,
                    'created_at' => now('UTC'),
                    'updated_at' => now('UTC'),
                ]);
                if ($inserted === 1) {
                    // The database-backed queue row and recipient delivery commit together.
                    SendBirthdayPush::dispatch($this->churchId, $deliveryId);
                }
            }
        });
    }
}
