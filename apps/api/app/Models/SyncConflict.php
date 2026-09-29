<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use LogicException;

class SyncConflict extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'existing_value' => 'array',
            'incoming_value' => 'array',
            'was_finalized' => 'boolean',
            'existing_occurred_at' => 'immutable_datetime',
            'existing_received_at' => 'immutable_datetime',
            'incoming_occurred_at' => 'immutable_datetime',
            'incoming_received_at' => 'immutable_datetime',
            'resolved_at' => 'immutable_datetime',
        ];
    }

    public function save(array $options = [])
    {
        if ($this->exists && array_diff(array_keys($this->getDirty()), [
            'status', 'resolution', 'resolved_by', 'resolved_at', 'updated_at',
        ]) !== []) {
            throw new LogicException('Sync conflict evidence is immutable.');
        }

        return parent::save($options);
    }
}
