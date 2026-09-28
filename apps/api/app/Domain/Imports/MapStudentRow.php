<?php

namespace App\Domain\Imports;

use App\Actions\Students\NormalizeStudentInput;
use InvalidArgumentException;

final class MapStudentRow
{
    public function map(array $row, array $ministries): array
    {
        $clean = [];
        foreach ($row as $key => $value) {
            $clean[$key] = is_string($value) ? trim($value) : $value;
            if ($clean[$key] === '') {
                $clean[$key] = null;
            }
        }

        $birthdate = $clean['birthdate'] ?? null;
        if ($birthdate !== null && (! is_string($birthdate) || preg_match('/\A\d{4}-\d{2}-\d{2}\z/', $birthdate) !== 1)) {
            return $this->invalid('Birthdate must use YYYY-MM-DD or a genuine Excel date cell.', $clean);
        }
        if (is_string($clean['suffix'] ?? null) && mb_strlen($clean['suffix']) > 40) {
            return $this->invalid('Student details are invalid.', $clean);
        }

        try {
            $data = NormalizeStudentInput::handle([
                'first_name' => $clean['first_name'] ?? null,
                'middle_name' => $clean['middle_name'] ?? null,
                'last_name' => $clean['last_name'] ?? null,
                'preferred_name' => $clean['preferred_name'] ?? null,
                'suffix' => $clean['suffix'] ?? null,
                'date_of_birth' => $birthdate,
                'gender' => $clean['gender'] ?? null,
                'external_reference' => $clean['external_reference'] ?? null,
            ])->toArray();
        } catch (InvalidArgumentException) {
            return $this->invalid('Student details are invalid.', $clean);
        }

        $names = [];
        $ids = [];
        $unknown = [];
        foreach (explode(';', (string) ($clean['ministries'] ?? '')) as $name) {
            $name = trim(preg_replace('/[\s\p{Z}]+/u', ' ', $name) ?? '');
            if ($name === '') {
                continue;
            }
            $key = mb_strtolower($name);
            if (isset($names[$key])) {
                continue;
            }
            $names[$key] = $name;
            if (isset($ministries[$key])) {
                $ids[] = $ministries[$key];
            } else {
                $unknown[] = $name;
            }
        }

        return [
            'status' => $unknown === [] ? 'valid' : 'needs_mapping',
            'source_data' => $clean,
            'data' => $data,
            'ministry_names' => array_values($names),
            'ministry_ids' => array_values(array_unique($ids)),
            'unknown_ministries' => $unknown,
            'errors' => [],
        ];
    }

    private function invalid(string $message, array $source): array
    {
        return [
            'status' => 'invalid', 'source_data' => $source, 'data' => [], 'ministry_names' => [],
            'ministry_ids' => [], 'unknown_ministries' => [], 'errors' => [$message],
        ];
    }
}
