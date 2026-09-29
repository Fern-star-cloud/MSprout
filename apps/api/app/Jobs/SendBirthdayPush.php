<?php

namespace App\Jobs;

use App\Domain\Notifications\FindBirthdayRecipients;
use App\Models\BirthdayNotificationDelivery;
use App\Models\Church;
use App\Models\ChurchMembership;
use App\Models\PushSubscription;
use App\Support\Notifications\PushSender;
use App\Support\Tenancy\TenantContext;
use Carbon\CarbonImmutable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use RuntimeException;

final class SendBirthdayPush implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $uniqueFor = 86_400;

    public function __construct(public readonly string $churchId, public readonly string $deliveryId) {}

    public function uniqueId(): string
    {
        return $this->churchId.':'.$this->deliveryId;
    }

    /** @return array{title: string, body: string, url: string, tag: string} */
    public static function payload(int $count): array
    {
        return [
            'title' => 'Birthday reminder',
            'body' => $count.' '.($count === 1 ? 'child is' : 'children are').' celebrating today. Open the app to view.',
            'url' => '/account/birthdays',
            'tag' => 'birthday-reminder',
        ];
    }

    public function handle(TenantContext $tenancy, PushSender $sender, FindBirthdayRecipients $finder): void
    {
        $claimed = $tenancy->runForSystem($this->churchId, function () use ($finder): ?array {
            $delivery = BirthdayNotificationDelivery::query()->whereKey($this->deliveryId)->lockForUpdate()->first();
            if ($delivery === null || in_array($delivery->status, ['delivered', 'revoked'], true)) {
                return null;
            }
            $subscription = PushSubscription::query()->whereKey($delivery->push_subscription_id)
                ->where('membership_id', $delivery->membership_id)
                ->whereNull('revoked_at')->first();
            if ($subscription === null) {
                $delivery->forceFill(['status' => 'revoked', 'failure_category' => 'subscription_revoked'])->save();

                return null;
            }
            $membership = ChurchMembership::query()->whereKey($delivery->membership_id)
                ->where('user_id', $delivery->user_id)->where('status', 'active')->first();
            $localDate = CarbonImmutable::parse($delivery->local_date->toDateString(), 'UTC');
            $timezone = Church::query()->whereKey($this->churchId)->value('timezone');
            if (! is_string($timezone) || CarbonImmutable::now($timezone)->toDateString() !== $localDate->toDateString()) {
                $delivery->forceFill(['status' => 'revoked', 'failure_category' => 'local_date_expired'])->save();

                return null;
            }
            $birthdayCount = $membership === null ? 0 : count($finder->birthdays($membership, $localDate));
            if ($birthdayCount === 0) {
                $delivery->forceFill(['status' => 'revoked', 'failure_category' => 'authorization_revoked'])->save();

                return null;
            }
            $delivery->forceFill([
                'status' => 'sending',
                'birthday_count' => $birthdayCount,
                'attempt_count' => $delivery->attempt_count + 1,
                'last_attempt_at' => now('UTC'),
                'failure_category' => null,
            ])->save();

            return ['subscription' => $subscription, 'count' => $birthdayCount];
        });
        if ($claimed === null) {
            return;
        }

        $result = $sender->send($claimed['subscription'], self::payload($claimed['count']));
        $tenancy->runForSystem($this->churchId, function () use ($result): void {
            $delivery = BirthdayNotificationDelivery::query()->whereKey($this->deliveryId)->lockForUpdate()->firstOrFail();
            $subscription = PushSubscription::query()->whereKey($delivery->push_subscription_id)->lockForUpdate()->first();
            if ($result->successful) {
                $delivery->forceFill(['status' => 'delivered', 'delivered_at' => now('UTC'), 'failure_category' => null])->save();
                $subscription?->forceFill(['last_success_at' => now('UTC'), 'failure_count' => 0])->save();

                return;
            }
            $delivery->forceFill([
                'status' => $result->permanentFailure ? 'revoked' : 'failed',
                'failure_category' => $result->failureCategory,
            ])->save();
            if ($subscription !== null) {
                $subscription->forceFill([
                    'failure_count' => $subscription->failure_count + 1,
                    'revoked_at' => $result->permanentFailure ? now('UTC') : null,
                ])->save();
            }
        });

        if (! $result->successful && ! $result->permanentFailure) {
            throw new RuntimeException('Birthday push delivery failed.');
        }
    }
}
