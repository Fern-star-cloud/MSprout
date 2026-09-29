<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

final class PushSubscription extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected $hidden = [
        'endpoint_hash',
        'endpoint_ciphertext',
        'p256dh_ciphertext',
        'auth_ciphertext',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'immutable_datetime',
            'last_success_at' => 'immutable_datetime',
            'revoked_at' => 'immutable_datetime',
        ];
    }
}
