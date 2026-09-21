<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Invitation extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected $hidden = ['token_hash'];

    protected function casts(): array
    {
        return ['expires_at' => 'immutable_datetime', 'accepted_at' => 'immutable_datetime', 'revoked_at' => 'immutable_datetime'];
    }

    public function projection(): array
    {
        return [
            'id' => $this->id, 'email' => $this->email, 'role' => 'teacher',
            'expires_at' => $this->expires_at->toIso8601String(),
            'status' => $this->accepted_at ? 'accepted' : ($this->revoked_at ? 'revoked' : ($this->expires_at->isPast() ? 'expired' : 'pending')),
        ];
    }
}
