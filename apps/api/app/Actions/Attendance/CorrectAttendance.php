<?php

namespace App\Actions\Attendance;

use App\Domain\Attendance\PublishAttendanceChange;
use App\Domain\Audit\AuditEntry;
use App\Domain\Audit\AuditWriter;
use App\Enums\AttendanceSessionStatus;
use App\Enums\ChurchRole;
use App\Models\AttendanceRecord;
use App\Models\AttendanceRevision;
use App\Models\AttendanceSession;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use DomainException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class CorrectAttendance
{
    public function handle(string $sessionId, string $recordId, string $state, string $reason, User $actor): array
    {
        if (app(TenantContext::class)->role() !== ChurchRole::Owner) {
            throw new AuthorizationException;
        }
        if (! in_array($state, ['present', 'absent'], true)) {
            throw new DomainException('Attendance state is invalid.');
        }
        $reason = trim((string) preg_replace('/[\s\p{Z}]+/u', ' ', $reason));
        if ($reason === '' || mb_strlen($reason) > 500) {
            throw new DomainException('A correction reason between 1 and 500 characters is required.');
        }

        return DB::transaction(function () use ($sessionId, $recordId, $state, $reason, $actor): array {
            $churchId = app(TenantContext::class)->churchId();
            DB::selectOne('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', ['record:'.$sessionId]);
            $session = AttendanceSession::query()->where('church_id', $churchId)->lockForUpdate()->findOrFail($sessionId);
            if (! in_array($session->status, [AttendanceSessionStatus::Finalized, AttendanceSessionStatus::Revised], true)) {
                throw new DomainException('Only finalized attendance can be corrected.');
            }
            $record = AttendanceRecord::query()
                ->where('church_id', $churchId)->where('attendance_session_id', $session->id)
                ->lockForUpdate()->findOrFail($recordId);
            $before = AttendanceRevision::query()
                ->where('church_id', $churchId)->where('attendance_record_id', $record->id)
                ->latest('revised_at')->latest('id')->value('after_state') ?? $record->state->value;
            if ($before === $state) {
                throw new DomainException('The corrected value must differ from the current value.');
            }
            $revision = AttendanceRevision::create([
                'id' => (string) Str::uuid(), 'church_id' => $churchId,
                'attendance_session_id' => $session->id, 'attendance_record_id' => $record->id,
                'before_state' => $before, 'after_state' => $state,
                'original_actor_id' => $record->recorded_by, 'resolving_actor_id' => $actor->id,
                'reason' => $reason, 'revised_at' => now('UTC'),
            ]);
            $session->forceFill(['status' => AttendanceSessionStatus::Revised, 'version' => $session->version + 1])->save();
            app(AuditWriter::class)->record(new AuditEntry(
                'church', 'attendance.corrected', 'user', (string) $actor->id,
                'attendance_record', $record->id, 'success', $churchId,
            ));
            app(PublishAttendanceChange::class)->handle($session);

            return ['revision_id' => $revision->id, 'effective_state' => $state, 'version' => $session->version];
        });
    }
}
