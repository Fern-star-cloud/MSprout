<?php

namespace App\Support\Notifications;

use App\Models\PushSubscription;
use Illuminate\Support\Facades\Crypt;
use JsonException;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;
use Throwable;

final class WebPushSender implements PushSender
{
    public function send(PushSubscription $subscription, array $payload): PushSendResult
    {
        $subject = config('services.webpush.subject');
        $publicKey = config('services.webpush.public_key');
        $privateKey = config('services.webpush.private_key');
        if (! is_string($subject) || ! is_string($publicKey) || ! is_string($privateKey)
            || $subject === '' || $publicKey === '' || $privateKey === '') {
            return new PushSendResult(false, false, 'configuration');
        }

        try {
            $webPush = new WebPush(['VAPID' => [
                'subject' => $subject,
                'publicKey' => $publicKey,
                'privateKey' => $privateKey,
            ]], ['TTL' => 43_200, 'urgency' => 'normal', 'topic' => 'birthday-reminder', 'contentType' => 'application/json']);
            $browserSubscription = Subscription::create([
                'endpoint' => Crypt::decryptString($subscription->endpoint_ciphertext),
                'keys' => [
                    'p256dh' => Crypt::decryptString($subscription->p256dh_ciphertext),
                    'auth' => Crypt::decryptString($subscription->auth_ciphertext),
                ],
                'contentEncoding' => $subscription->content_encoding,
            ]);
            $json = json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
            $report = $webPush->sendOneNotification($browserSubscription, $json);

            return new PushSendResult($report->isSuccess(), $report->isSubscriptionExpired(), $report->isSubscriptionExpired() ? 'expired' : 'push_service');
        } catch (JsonException) {
            return new PushSendResult(false, false, 'payload');
        } catch (Throwable) {
            // Upstream exceptions can include the private endpoint. Return a bounded category only.
            return new PushSendResult(false, false, 'transport');
        }
    }
}
