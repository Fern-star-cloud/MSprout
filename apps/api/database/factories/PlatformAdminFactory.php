<?php

namespace Database\Factories;

use App\Models\PlatformAdmin;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PlatformAdmin>
 */
final class PlatformAdminFactory extends Factory
{
    protected $model = PlatformAdmin::class;

    public function definition(): array
    {
        return [
            'handle' => fake()->unique()->userName(),
            'recovery_email' => fake()->unique()->safeEmail(),
            'status' => 'pending',
            'password' => null,
            'setup_expires_at' => now()->addMinutes(30),
        ];
    }
}
