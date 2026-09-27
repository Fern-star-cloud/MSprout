<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use LogicException;

class AuditEvent extends Model
{
    use HasFactory;

    public $incrementing = false;

    public $timestamps = false;

    protected $keyType = 'string';

    protected $guarded = [];

    protected $hidden = ['metadata_json'];

    protected function casts(): array
    {
        return ['metadata_json' => 'array', 'occurred_at' => 'immutable_datetime'];
    }

    public function save(array $options = [])
    {
        if ($this->exists) {
            throw new LogicException('Audit records are append-only.');
        }

        return parent::save($options);
    }

    public function delete()
    {
        throw new LogicException('Audit records are append-only.');
    }
}
