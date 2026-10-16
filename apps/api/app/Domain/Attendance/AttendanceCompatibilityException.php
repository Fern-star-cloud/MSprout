<?php

namespace App\Domain\Attendance;

use Symfony\Component\HttpKernel\Exception\HttpException;

final class AttendanceCompatibilityException extends HttpException
{
    public function __construct(public readonly string $errorCode = 'attendance_compatibility_required')
    {
        parent::__construct(in_array($errorCode, ['invalid_attendance_reader', 'unsupported_attendance_reader'], true) ? 400 : 409, match ($errorCode) {
            'invalid_attendance_reader' => 'The attendance reader declaration is invalid.',
            'unsupported_attendance_reader' => 'The attendance reader is not supported.',
            'full_bootstrap_required' => 'Device recovery is required. Preserve saved local attendance.',
            default => 'This request cannot be processed safely by this app and server combination. Keep saved work and use a supported version.',
        });
    }
}
