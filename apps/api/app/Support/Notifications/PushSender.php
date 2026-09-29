<?php

namespace App\Support\Notifications;

use App\Models\PushSubscription;

interface PushSender
{
    /** @param array{title: string, body: string, url: string, tag: string} $payload */
    public function send(PushSubscription $subscription, array $payload): PushSendResult;
}
