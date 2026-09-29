<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

final class DeviceCursor extends Model
{
    use HasUuids;

    public const UPDATED_AT = 'updated_at';

    public const CREATED_AT = null;

    protected $guarded = [];
}
