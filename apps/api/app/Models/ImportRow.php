<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ImportRow extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'source_data' => 'array',
            'normalized_data' => 'array',
            'ministry_names' => 'array',
            'ministry_ids' => 'array',
            'unknown_ministries' => 'array',
            'errors' => 'array',
        ];
    }
}
