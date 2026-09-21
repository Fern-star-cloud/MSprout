<?php

namespace App\Models;

use App\Enums\ApplicationStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ChurchApplication extends Model
{
    use HasUuids;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['status' => ApplicationStatus::class, 'decided_at' => 'immutable_datetime', 'purged_at' => 'immutable_datetime'];
    }

    public function projection(): array
    {
        return [
            'id' => $this->id, 'status' => $this->status->value, 'church_name' => $this->church_name,
            'timezone' => $this->timezone, 'city' => $this->city, 'address' => $this->address,
            'church_id' => $this->church_id, 'category' => $this->category, 'reason' => $this->reason,
            'submitted_at' => $this->created_at->toISOString(), 'decided_at' => $this->decided_at?->toISOString(),
        ];
    }
}
