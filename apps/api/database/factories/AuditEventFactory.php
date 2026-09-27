<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class AuditEventFactory extends Factory
{
    public function definition(): array
    {
        return [
            'id' => (string) Str::uuid(), 'category' => 'platform', 'church_id' => null,
            'actor_type' => 'system', 'actor_id' => null, 'action' => 'application.approved',
            'target_type' => 'application', 'target_id' => (string) Str::uuid(), 'result' => 'success',
            'device_id' => null, 'sync_batch_id' => null, 'correlation_id' => (string) Str::uuid(),
            'metadata_json' => [], 'occurred_at' => now('UTC'),
        ];
    }
}
