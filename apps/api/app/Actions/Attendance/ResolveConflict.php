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
use App\Models\SyncConflict;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use DomainException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ResolveConflict
{
    public function handle(string $conflictId, string $choice, string $reason, User $actor): array
    {
        $this->owner();
        $reason = $this->reason($reason);
        if (! in_array($choice, ['existing', 'incoming'], true)) {
            throw new DomainException('Choose the existing or incoming value.');
        }
        $sessionId = SyncConflict::query()->findOrFail($conflictId)->attendance_session_id;

        return DB::transaction(function () use ($conflictId, $choice, $reason, $actor, $sessionId): array {
            $churchId = app(TenantContext::class)->churchId();
            DB::selectOne('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', ['record:'.$sessionId]);
            $conflict = SyncConflict::query()->where('church_id', $churchId)->lockForUpdate()->findOrFail($conflictId);
            if ($conflict->status !== 'open' || $conflict->field !== 'state' || $conflict->attendance_record_id === null) {
                throw new DomainException('This conflict is no longer available for resolution.');
            }
            $record = AttendanceRecord::query()->where('church_id', $churchId)->lockForUpdate()->findOrFail($conflict->attendance_record_id);
            $session = AttendanceSession::query()->where('church_id', $churchId)->lockForUpdate()->findOrFail($conflict->attendance_session_id);
            $before = $this->effectiveState($record);
            $after = (string) $conflict->{$choice.'_value'}['state'];
            $revision = AttendanceRevision::create([
                'id' => (string) Str::uuid(),
                'church_id' => $churchId,
                'attendance_session_id' => $session->id,
                'attendance_record_id' => $record->id,
                'sync_conflict_id' => $conflict->id,
                'before_state' => $before,
                'after_state' => $after,
                'original_actor_id' => $record->recorded_by ?? $conflict->existing_actor_id,
                'resolving_actor_id' => $actor->id,
                'reason' => $reason,
                'revised_at' => now('UTC'),
            ]);
            $conflict->forceFill([
                'status' => 'resolved', 'resolution' => $choice,
                'resolved_by' => $actor->id, 'resolved_at' => now('UTC'),
            ])->save();
            $hasOpenConflicts = SyncConflict::query()
                ->where('church_id', $churchId)
                ->where('attendance_session_id', $session->id)
                ->where('status', 'open')
                ->exists();
            $session->forceFill([
                'status' => $hasOpenConflicts
                    ? AttendanceSessionStatus::NeedsReview
                    : ($session->finalized_at !== null ? AttendanceSessionStatus::Revised : AttendanceSessionStatus::Draft),
                'version' => $session->version + 1,
            ])->save();
            app(AuditWriter::class)->record(new AuditEntry(
                'church', 'attendance.conflict.resolved', 'user', (string) $actor->id,
                'sync_conflict', $conflict->id, 'success', $churchId,
            ));
            app(PublishAttendanceChange::class)->handle($session);

            return ['id' => $conflict->id, 'status' => 'resolved', 'revision_id' => $revision->id, 'effective_state' => $after, 'version' => $session->version];
        });
    }

    private function effectiveState(AttendanceRecord $record): string
    {
        return AttendanceRevision::query()
            ->where('church_id', $record->church_id)
            ->where('attendance_record_id', $record->id)
            ->latest('revised_at')->latest('id')->value('after_state') ?? $record->state->value;
    }

    private function reason(string $reason): string
    {
        $reason = trim((string) preg_replace('/[\s\p{Z}]+/u', ' ', $reason));
        if ($reason === '' || mb_strlen($reason) > 500) {
            throw new DomainException('A correction reason between 1 and 500 characters is required.');
        }

        return $reason;
    }

    private function owner(): void
    {
        if (app(TenantContext::class)->role() !== ChurchRole::Owner) {
            throw new AuthorizationException;
        }
    }
}
