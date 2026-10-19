<?php

return [
    // Public role identity only. Credentials are never loaded into web configuration.
    'role' => env('DB_MAINTENANCE_USERNAME'),
    'process' => env('MSPROUT_MAINTENANCE_PROCESS', false),
];
