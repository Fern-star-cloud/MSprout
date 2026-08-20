<?php

namespace App\Models;

use App\Enums\ChurchRole;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChurchMembership extends Model
{
    use HasUuids;

    protected $fillable = [
        'id',
        'church_id',
        'user_id',
        'role',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'role' => ChurchRole::class,
        ];
    }

    public function church(): BelongsTo
    {
        return $this->belongsTo(Church::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
