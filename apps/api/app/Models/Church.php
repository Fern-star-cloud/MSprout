<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Church extends Model
{
    use HasUuids;

    protected $fillable = [
        'name',
        'slug',
        'timezone',
        'status',
    ];

    public function memberships(): HasMany
    {
        return $this->hasMany(ChurchMembership::class);
    }
}
