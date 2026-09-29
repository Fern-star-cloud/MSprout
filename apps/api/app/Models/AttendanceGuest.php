<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use LogicException;

class AttendanceGuest extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'occurred_at' => 'immutable_datetime',
            'received_at' => 'immutable_datetime',
            'resolved_at' => 'immutable_datetime',
        ];
    }

    public function save(array $options = [])
    {
        if ($this->exists && array_diff(array_keys($this->getDirty()), [
            'status', 'resolved_student_id', 'merged_into_guest_id', 'resolved_by', 'resolved_at', 'updated_at',
        ]) !== []) {
            throw new LogicException('Attendance guest provenance is immutable.');
        }

        return parent::save($options);
    }
}
