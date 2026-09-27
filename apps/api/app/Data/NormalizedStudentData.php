<?php

namespace App\Data;

use App\Enums\Gender;
use Carbon\CarbonImmutable;

final readonly class NormalizedStudentData
{
    public function __construct(
        public string $firstName,
        public ?string $middleName,
        public string $lastName,
        public ?string $preferredName,
        public ?string $suffix,
        public ?CarbonImmutable $dateOfBirth,
        public Gender $gender,
        public ?string $externalReference,
    ) {}

    public function toArray(): array
    {
        return [
            'first_name' => $this->firstName, 'middle_name' => $this->middleName,
            'last_name' => $this->lastName, 'preferred_name' => $this->preferredName,
            'suffix' => $this->suffix, 'date_of_birth' => $this->dateOfBirth?->toDateString(),
            'gender' => $this->gender->value, 'external_reference' => $this->externalReference,
        ];
    }
}
