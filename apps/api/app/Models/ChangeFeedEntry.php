<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

final class ChangeFeedEntry extends Model
{
    protected $table = 'change_feed';

    protected $primaryKey = 'sequence';

    public $incrementing = true;

    public $timestamps = false;

    protected $guarded = [];

    protected static function booted(): void
    {
        self::creating(function (self $entry): void {
            $entry->id ??= (string) Str::uuid();
            $entry->created_at ??= now('UTC');
        });
    }

    protected function casts(): array
    {
        return [
            'payload_json' => 'array',
            'created_at' => 'immutable_datetime',
        ];
    }
}
