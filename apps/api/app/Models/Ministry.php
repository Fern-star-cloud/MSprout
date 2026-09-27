<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Ministry extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['archived_at' => 'immutable_datetime'];
    }
}
