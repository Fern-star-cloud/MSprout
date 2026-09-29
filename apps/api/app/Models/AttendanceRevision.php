<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use LogicException;

class AttendanceRevision extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['revised_at' => 'immutable_datetime'];
    }

    public function save(array $options = [])
    {
        if ($this->exists) {
            throw new LogicException('Attendance revisions are append-only.');
        }

        return parent::save($options);
    }

    public function delete()
    {
        throw new LogicException('Attendance revisions are append-only.');
    }
}
