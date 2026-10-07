<?php

namespace App\Models;

use Database\Factories\PlatformAdminFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Fortify\TwoFactorAuthenticatable;

final class PlatformAdmin extends Authenticatable
{
    /** @use HasFactory<PlatformAdminFactory> */
    use HasFactory, HasUuids, TwoFactorAuthenticatable;

    protected $table = 'platform_admins';

    protected $attributes = ['setup_generation' => 1];

    protected $fillable = [
        'handle',
        'recovery_email',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'two_factor_secret',
        'two_factor_recovery_codes',
    ];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'email_verified_at' => 'datetime',
            'two_factor_confirmed_at' => 'datetime',
            'recovery_codes_acknowledged_at' => 'datetime',
            'setup_expires_at' => 'datetime',
            'setup_generation' => 'integer',
            'setup_redeemed_at' => 'datetime',
            'setup_issued_at' => 'datetime',
            'last_authenticated_at' => 'datetime',
        ];
    }

    public function eligibleForSetup(): bool
    {
        return $this->status === 'pending'
            && $this->two_factor_confirmed_at === null
            && $this->recovery_codes_acknowledged_at === null
            && $this->last_authenticated_at === null;
    }
}
