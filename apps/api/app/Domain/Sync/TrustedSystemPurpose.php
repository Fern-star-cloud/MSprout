<?php

namespace App\Domain\Sync;

enum TrustedSystemPurpose: string
{
    case BirthdayNotification = 'birthday_notification';
    case RetentionCleanup = 'retention_cleanup';
    case RevokedDeviceCleanup = 'revoked_device_cleanup';

    public function allowsStatus(string $status): bool
    {
        return $status === 'active' || ($status === 'suspended' && $this !== self::BirthdayNotification);
    }
}
