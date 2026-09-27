<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Student extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['date_of_birth' => 'immutable_date', 'deleted_at' => 'immutable_datetime'];
    }

    public function enrollments()
    {
        return $this->hasMany(Enrollment::class, 'student_id')->where('church_id', $this->church_id);
    }

    public function projection(bool $owner, ?array $visibleMinistryIds = null): array
    {
        $display = $this->preferred_name ?: trim($this->first_name.' '.($this->middle_name ? $this->middle_name.' ' : '').$this->last_name.($this->suffix ? ' '.$this->suffix : ''));
        $ministryIds = $this->enrollments()->whereNull('deleted_at')->pluck('ministry_id')->all();
        if (! $owner && $visibleMinistryIds !== null) {
            $ministryIds = array_values(array_intersect($ministryIds, $visibleMinistryIds));
        }
        $data = ['id' => $this->id, 'first_name' => $this->first_name, 'middle_name' => $this->middle_name,
            'last_name' => $this->last_name, 'preferred_name' => $this->preferred_name, 'suffix' => $this->suffix,
            'display_name' => $display, 'gender' => $this->gender, 'status' => $this->deleted_at ? 'archived' : 'active',
            'version' => $this->version, 'ministry_ids' => $ministryIds];
        if ($owner) {
            $data['date_of_birth'] = $this->date_of_birth?->toDateString();
            $data['age'] = $this->date_of_birth?->age;
            $data['external_reference'] = $this->external_reference;
        } else {
            $data['birth_month_day'] = $this->date_of_birth?->format('m-d');
            $data['age'] = $this->date_of_birth?->age;
        }

        return $data;
    }
}
