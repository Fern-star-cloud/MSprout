<?php

namespace Database\Factories;

use App\Models\PlatformAdmin;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;
use Laravel\Fortify\Fortify;
use PragmaRX\Google2FA\Google2FA;

/**
 * @extends Factory<PlatformAdmin>
 */
final class PlatformAdminFactory extends Factory
{
    protected $model = PlatformAdmin::class;

    public function active(): static
    {
        return $this->state(fn () => [
            'status' => 'active', 'password' => Str::password(32), 'email_verified_at' => now(),
            'two_factor_secret' => Fortify::currentEncrypter()->encrypt((new Google2FA)->generateSecretKey()),
            'two_factor_confirmed_at' => now(), 'recovery_codes_acknowledged_at' => now(), 'setup_expires_at' => null,
        ]);
    }

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
