<?php

return [
    // Deployment/cutover is a separately approved operation. Never request-controlled.
    'coordinated_publication' => env('SYNC_COORDINATED_PUBLICATION', false),
];
