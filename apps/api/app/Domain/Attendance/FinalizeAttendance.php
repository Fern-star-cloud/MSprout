<?php

namespace App\Domain\Attendance;

use App\Domain\Audit\AuditEntry;
use App\Domain\Audit\AuditWriter;
use App\Enums\AttendanceSessionStatus;
use App\Enums\AttendanceState;
use App\Models\AttendanceRecord;
use App\Models\AttendanceSession;
use App\Models\Enrollment;
use App\Models\User;
use App\Policies\AttendancePolicy;
use App\Support\Tenancy\TenantContext;
use DomainException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;

final class FinalizeAttendance
{
    public function handle(string $sessionId, User $actor): AttendanceSession
    {
        return DB::transaction(function () use ($sessionId, $actor): AttendanceSession {
            $churchId = app(TenantContext::class)->churchId();
            $session = AttendanceSession::query()
                ->where('church_id', $churchId)
                ->lockForUpdate()
                ->findOrFail($sessionId);

            if ($session->status !== AttendanceSessionStatus::Draft) {
                throw new DomainException('Only a draft attendance session can be finalized.');
            }
            if (! (new AttendancePolicy)->finalize($actor, $session)) {
                throw new AuthorizationException;
            }

            $expectedStudentIds = Enrollment::query()
                ->join('students', function ($join): void {
                    $join->on('students.church_id', '=', 'enrollments.church_id')
                        ->on('students.id', '=', 'enrollments.student_id');
                })
                ->where('enrollments.church_id', $churchId)
                ->where('enrollments.ministry_id', $session->ministry_id)
                ->whereNull('enrollments.deleted_at')
                ->whereNull('students.deleted_at')
                ->orderBy('enrollments.student_id')
                ->pluck('enrollments.student_id')
                ->all();
            $records = AttendanceRecord::query()
                ->where('church_id', $churchId)
                ->where('attendance_session_id', $session->id)
                ->whereNull('deleted_at')
                ->lockForUpdate()
                ->orderBy('student_id')
                ->get();

            if ($records->pluck('student_id')->all() !== $expectedStudentIds) {
                throw new DomainException('Attendance records must exactly match the active regular roster.');
            }
            if ($records->contains(fn (AttendanceRecord $record): bool => $record->state === AttendanceState::Unmarked)) {
                throw new DomainException('Every unmarked regular roster entry must be resolved before finalization.');
            }

            $session->forceFill([
                'status' => AttendanceSessionStatus::Finalized,
                'version' => $session->version + 1,
                'finalized_by' => $actor->id,
                'finalized_at' => now('UTC'),
            ])->save();

            app(AuditWriter::class)->record(new AuditEntry(
                'church',
                'attendance.finalized',
                'user',
                (string) $actor->id,
                'attendance_session',
                $session->id,
                'success',
                $churchId,
            ));

            return $session->refresh();
        });
    }
}
