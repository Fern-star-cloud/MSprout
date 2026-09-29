<?php

return [
    'readiness_token' => env('READINESS_TOKEN'),
    'queue_lag_warning_seconds' => (int) env('QUEUE_LAG_WARNING_SECONDS', 300),
    'scheduler_stale_seconds' => (int) env('SCHEDULER_STALE_SECONDS', 180),
    'operational_retention_days' => 30,
    'security_retention_days' => 180,
    'sync_receipt_retention_days' => 180,
    'change_feed_retention_days' => 90,
    'revoked_device_secret_retention_days' => 30,
    'offline_authorization_retention_days' => 180,
];
