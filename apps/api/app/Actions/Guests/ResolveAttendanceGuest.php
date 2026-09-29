<?php

namespace App\Actions\Guests;

use App\Actions\Students\NormalizeStudentInput;
use App\Domain\Attendance\PublishAttendanceChange;
use App\Domain\Audit\AuditEntry;
use App\Domain\Audit\AuditWriter;
use App\Enums\AttendanceSessionStatus;
use App\Enums\ChurchRole;
use App\Models\AttendanceGuest;
use App\Models\AttendanceRecord;
use App\Models\AttendanceSession;
use App\Models\Enrollment;
use App\Models\Student;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use DomainException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ResolveAttendanceGuest
{
    public function handle(string $guestId, string $resolution, array $input, User $actor): array
    {
        if (app(TenantContext::class)->role() !== ChurchRole::Owner) {
            throw new AuthorizationException;
        }
        if (! in_array($resolution, ['promote', 'link', 'merge'], true)) {
            throw new DomainException('Guest resolution is invalid.');
        }
        $sessionId = AttendanceGuest::query()->findOrFail($guestId)->attendance_session_id;

        return DB::transaction(function () use ($guestId, $resolution, $input, $actor, $sessionId): array {
            $churchId = app(TenantContext::class)->churchId();
            DB::selectOne('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', ['record:'.$sessionId]);
            $lockIds = array_values(array_unique(array_filter([$guestId, $resolution === 'merge' ? ($input['guest_id'] ?? null) : null], 'is_string')));
            sort($lockIds);
            $lockedGuests = AttendanceGuest::query()->where('church_id', $churchId)->whereIn('id', $lockIds)
                ->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            $guest = $lockedGuests->get($guestId) ?? throw new DomainException('The attendance guest was not found.');
            if ($guest->status !== 'pending') {
                throw new DomainException('This guest is no longer pending.');
            }
            $session = AttendanceSession::query()->where('church_id', $churchId)->lockForUpdate()->findOrFail($guest->attendance_session_id);

            if ($resolution === 'merge') {
                $targetId = $input['guest_id'] ?? null;
                if (! is_string($targetId) || ! Str::isUuid($targetId) || $targetId === $guest->id) {
                    throw new DomainException('A different guest from this session is required.');
                }
                $target = $lockedGuests->get($targetId);
                if ($target === null || $target->attendance_session_id !== $session->id || $target->status === 'merged') {
                    throw new DomainException('The selected guest cannot receive this merge.');
                }
                $guest->forceFill([
                    'status' => 'merged', 'merged_into_guest_id' => $target->id,
                    'resolved_student_id' => $target->resolved_student_id,
                    'resolved_by' => $actor->id, 'resolved_at' => now('UTC'),
                ])->save();
            } else {
                $student = $resolution === 'promote'
                    ? $this->promote($churchId, $input, $guest)
                    : $this->student($churchId, $input);
                $this->linkAttendance($session, $guest, $student);
                $guest->forceFill([
                    'status' => $resolution === 'promote' ? 'promoted' : 'linked',
                    'resolved_student_id' => $student->id,
                    'resolved_by' => $actor->id, 'resolved_at' => now('UTC'),
                ])->save();
            }

            $session->forceFill([
                'status' => in_array($session->status, [AttendanceSessionStatus::Finalized, AttendanceSessionStatus::Revised], true)
                    ? AttendanceSessionStatus::Revised : $session->status,
                'version' => $session->version + 1,
            ])->save();
            app(AuditWriter::class)->record(new AuditEntry(
                'church', 'attendance.guest.'.($resolution === 'promote' ? 'promoted' : ($resolution === 'link' ? 'linked' : 'merged')),
                'user', (string) $actor->id, 'attendance_guest', $guest->id, 'success', $churchId,
            ));
            app(PublishAttendanceChange::class)->handle($session);

            return [
                'id' => $guest->id,
                'status' => $guest->status,
                'student_id' => $guest->resolved_student_id,
                'merged_into_guest_id' => $guest->merged_into_guest_id,
                'version' => $session->version,
            ];
        });
    }

    private function promote(string $churchId, array $input, AttendanceGuest $guest): Student
    {
        $normalized = NormalizeStudentInput::handle($input + ['gender' => $guest->gender]);
        $student = Student::create(['church_id' => $churchId, 'version' => 1] + $normalized->toArray());
        Enrollment::create([
            'church_id' => $churchId, 'student_id' => $student->id,
            'ministry_id' => AttendanceSession::findOrFail($guest->attendance_session_id)->ministry_id,
            'version' => 1,
        ]);

        return $student;
    }

    private function student(string $churchId, array $input): Student
    {
        $studentId = $input['student_id'] ?? null;
        if (! is_string($studentId) || ! Str::isUuid($studentId)) {
            throw new DomainException('An active student is required.');
        }

        return Student::query()->where('church_id', $churchId)->whereNull('deleted_at')->findOrFail($studentId);
    }

    private function linkAttendance(AttendanceSession $session, AttendanceGuest $guest, Student $student): void
    {
        $record = AttendanceRecord::query()
            ->where('church_id', $session->church_id)
            ->where('attendance_session_id', $session->id)
            ->where('student_id', $student->id)
            ->lockForUpdate()->first();
        if ($record === null) {
            AttendanceRecord::create([
                'church_id' => $session->church_id, 'attendance_session_id' => $session->id,
                'student_id' => $student->id, 'state' => 'present', 'version' => 1,
                'source_guest_id' => $guest->id, 'recorded_by' => $guest->created_by,
                'recorded_device_id' => $guest->source_device_id,
                'recorded_correlation_id' => $guest->source_correlation_id,
                'recorded_at' => $guest->occurred_at, 'recorded_received_at' => $guest->received_at,
            ]);

            return;
        }
        if ($record->state->value === 'absent') {
            throw new DomainException('The linked student has contradictory attendance that requires a correction.');
        }
        if ($record->state->value === 'unmarked') {
            $record->forceFill([
                'state' => 'present', 'version' => $record->version + 1,
                'source_guest_id' => $guest->id, 'recorded_by' => $guest->created_by,
                'recorded_device_id' => $guest->source_device_id,
                'recorded_correlation_id' => $guest->source_correlation_id,
                'recorded_at' => $guest->occurred_at, 'recorded_received_at' => $guest->received_at,
            ])->save();
        }
    }
}
