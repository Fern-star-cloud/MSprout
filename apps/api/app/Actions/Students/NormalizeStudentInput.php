<?php

namespace App\Actions\Students;

use App\Data\NormalizedStudentData;
use App\Enums\Gender;
use Carbon\CarbonImmutable;
use InvalidArgumentException;

final class NormalizeStudentInput
{
    public static function handle(array $input): NormalizedStudentData
    {
        $name = static function (string $field, bool $required = false) use ($input): ?string {
            $value = $input[$field] ?? null;
            if ($value === null || $value === '') {
                if ($required) {
                    throw new InvalidArgumentException("{$field} is required.");
                }

                return null;
            }
            if (! is_string($value)) {
                throw new InvalidArgumentException("{$field} must be text.");
            }
            $value = preg_replace('/[\s\p{Z}]+/u', ' ', $value);
            $value = is_string($value) ? trim($value) : null;
            if (! is_string($value) || $value === '' || mb_strlen($value) > 120) {
                throw new InvalidArgumentException("{$field} is invalid.");
            }

            return $value;
        };

        $rawGender = mb_strtolower(trim((string) ($input['gender'] ?? '')));
        $gender = match ($rawGender) {
            '', 'unspecified', 'unknown', 'other', 'prefer not to say' => Gender::Unspecified,
            'male', 'm', 'boy' => Gender::Male,
            'female', 'f', 'girl' => Gender::Female,
            default => throw new InvalidArgumentException('gender is invalid.'),
        };

        $date = null;
        if (($rawDate = $input['date_of_birth'] ?? null) !== null && $rawDate !== '') {
            if (! is_string($rawDate) || ! preg_match('/\A\d{4}-\d{2}-\d{2}\z/', $rawDate)) {
                throw new InvalidArgumentException('Birthdate must use YYYY-MM-DD.');
            }
            $parsed = CarbonImmutable::createFromFormat('!Y-m-d', $rawDate);
            if (! $parsed || $parsed->format('Y-m-d') !== $rawDate || $parsed->isFuture() || $parsed->lt(now()->subYears(120)->startOfDay())) {
                throw new InvalidArgumentException('Birthdate is outside the accepted range.');
            }
            $date = $parsed;
        }

        $reference = $name('external_reference');
        if ($reference !== null && mb_strlen($reference) > 120) {
            throw new InvalidArgumentException('external_reference is invalid.');
        }

        return new NormalizedStudentData(
            $name('first_name', true), $name('middle_name'), $name('last_name', true),
            $name('preferred_name'), $name('suffix'), $date, $gender, $reference,
        );
    }
}
