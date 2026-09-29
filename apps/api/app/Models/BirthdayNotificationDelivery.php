<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

final class BirthdayNotificationDelivery extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'local_date' => 'immutable_date',
            'last_attempt_at' => 'immutable_datetime',
            'delivered_at' => 'immutable_datetime',
        ];
    }
}
