<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ImportBatch extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'result_json' => 'array',
            'expires_at' => 'immutable_datetime',
            'committed_at' => 'immutable_datetime',
        ];
    }

    public function rows()
    {
        return $this->hasMany(ImportRow::class);
    }
}
