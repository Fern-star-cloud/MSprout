<?php

return [
    // Qualification only. Production entry and client completion stay disabled.
    'enabled' => env('RECOVERY_SNAPSHOTS_QUALIFICATION', false),
    'lifetime_seconds' => 14400,
    'max_input_pages' => 1000,
    'max_output_pages' => 10000,
    'max_items' => 2000000,
    'max_stored_bytes' => 536870912,
];
