<?php

namespace App\Domain\Attendance;

use InvalidArgumentException;

final class DetectAttendanceConflict
{
    public const APPLY = 'apply';

    public const DEDUPLICATE = 'deduplicate';

    public const MERGE = 'merge';

    public const REVIEW = 'review';

    public function classify(
        string $field,
        int $baseVersion,
        int $currentVersion,
        string $existingValue,
        string $incomingValue,
        bool $finalized,
    ): string {
        if ($field !== 'state' || $baseVersion < 0 || $currentVersion < 1) {
            throw new InvalidArgumentException('Unsupported attendance conflict projection.');
        }
        if (hash_equals($existingValue, $incomingValue)) {
            return self::DEDUPLICATE;
        }
        if (! $finalized && $baseVersion === $currentVersion) {
            return self::APPLY;
        }
        if (! $finalized && $baseVersion >= 1 && $baseVersion < $currentVersion && $existingValue === 'unmarked') {
            return self::MERGE;
        }

        return self::REVIEW;
    }
}
