<?php

namespace App\Support\Notifications;

final readonly class PushSendResult
{
    public function __construct(
        public bool $successful,
        public bool $permanentFailure = false,
        public string $failureCategory = 'transient',
    ) {}
}
