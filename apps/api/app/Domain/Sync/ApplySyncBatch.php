<?php

namespace App\Domain\Sync;

use App\Domain\Attendance\FinalizeAttendance;
use App\Domain\Audit\AuditEntry;
use App\Domain\Audit\AuditWriter;
use App\Domain\Audit\CorrelationContext;
use App\Enums\AttendanceSessionStatus;
use App\Models\AttendanceRecord;
use App\Models\AttendanceSession;
use App\Models\ChangeFeedEntry;
use App\Models\ChurchMembership;
use App\Models\Enrollment;
use App\Models\SyncEvent;
use App\Models\User;
use App\Policies\AttendancePolicy;
use App\Support\Tenancy\TenantContext;
use DomainException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

final class ApplySyncBatch
{
    /** @return array<int, array<string, mixed>> */
    public function handle(ChurchMembership $membership, string $deviceId, string $batchId, array $events, User $actor): array
    {
        $lockKeys = collect($events)->flatMap(fn (array $event): array => [
            'event:'.$deviceId.':'.$event['client_event_id'],
            'record:'.$event['entity_id'],
        ])->unique()->sort()->values();
        foreach ($lockKeys as $lockKey) {
            DB::selectOne('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', [$lockKey]);
        }

        $results = [];
        foreach ($events as $event) {
            $results[] = DB::transaction(fn (): array => $this->apply($membership, $deviceId, $batchId, $event, $actor));
        }

        return $results;
    }

    /** @return array<string, mixed> */
    private function apply(ChurchMembership $membership, string $deviceId, string $batchId, array $event, User $actor): array
    {
        $eventId = $event['client_event_id'];
        $hash = hash('sha256', json_encode($this->canonical($event), JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES));
        $existing = SyncEvent::query()
            ->where('church_id', $membership->church_id)
            ->where('device_id', $deviceId)
            ->where('client_event_id', $eventId)
            ->first();

        if ($existing !== null) {
            if ((int) $existing->actor_id !== (int) $actor->id || $existing->church_id !== $membership->church_id) {
                $this->auditResult($membership, $actor, $deviceId, $batchId, 'rejected');

                return $this->response($eventId, 'rejected', 'event_claim_mismatch');
            }
            if (! hash_equals($existing->payload_hash, $hash)) {
                $this->auditResult($membership, $actor, $deviceId, $batchId, 'rejected');

                return $this->response($eventId, 'rejected', 'event_mismatch');
            }

            return $this->response(
                $eventId,
                $existing->result_status === 'accepted' ? 'duplicate' : $existing->result_status,
                $existing->result_reason,
                $existing->result_record_id,
                $existing->result_version,
                $existing->result_status === 'accepted' ? 'accepted' : null,
            );
        }

        try {
            [$recordId, $version] = $this->applyAttendance($event, $actor, $deviceId, $batchId);
            $status = 'accepted';
            $reason = null;
        } catch (SyncResult $result) {
            $status = $result->status;
            $reason = $result->reason;
            $recordId = $result->recordId;
            $version = $result->version;
            $this->auditResult($membership, $actor, $deviceId, $batchId, $status);
        }

        SyncEvent::create([
            'church_id' => $membership->church_id,
            'device_id' => $deviceId,
            'client_event_id' => $eventId,
            'batch_id' => $batchId,
            'actor_id' => $actor->id,
            'payload_hash' => $hash,
            'result_status' => $status,
            'result_reason' => $reason,
            'result_record_id' => $recordId,
            'result_version' => $version,
            'received_at' => now('UTC'),
            'correlation_id' => app(CorrelationContext::class)->id(),
        ]);

        return $this->response($eventId, $status, $reason, $recordId, $version);
    }

    /** @return array{string, int} */
    private function applyAttendance(array $event, User $actor, string $deviceId, string $batchId): array
    {
        return match ($event['action']) {
            'attendance.draft_created' => $this->createDraft($event, $actor, $deviceId, $batchId),
            'attendance.student_marked' => $this->markStudent($event, $actor, $deviceId, $batchId),
            'attendance.bulk_marked' => $this->bulkMark($event, $actor, $deviceId, $batchId),
            'attendance.finalized' => $this->finalize($event, $actor, $deviceId, $batchId),
            default => throw new SyncResult('rejected', 'unsupported_action'),
        };
    }

    /** @return array{string, int} */
    private function createDraft(array $event, User $actor, string $deviceId, string $batchId): array
    {
        if ((int) $event['base_version'] !== 0 || ! $this->valid($event['payload'], [
            'ministry_id' => ['required', 'uuid'],
            'attendance_date' => ['required', 'date_format:Y-m-d'],
            'student_ids' => ['required', 'array', 'max:500'],
            'student_ids.*' => ['required', 'uuid', 'distinct'],
        ], ['ministry_id', 'attendance_date', 'student_ids'])) {
            throw new SyncResult('rejected', 'invalid_payload');
        }
        $payload = $event['payload'];
        if (! (new AttendancePolicy)->create($actor, $payload['ministry_id'])) {
            throw new SyncResult('rejected', 'assignment_revoked');
        }
        $existing = AttendanceSession::query()
            ->where('church_id', app(TenantContext::class)->churchId())
            ->where(fn ($query) => $query->whereKey($event['entity_id'])
                ->orWhere(fn ($candidate) => $candidate
                    ->where('ministry_id', $payload['ministry_id'])
                    ->where('attendance_date', $payload['attendance_date'])))
            ->lockForUpdate()
            ->first();
        if ($existing !== null) {
            throw new SyncResult('conflict', 'version_conflict', $existing->id, (int) $existing->version);
        }

        $expected = Enrollment::query()
            ->join('students', function ($join): void {
                $join->on('students.church_id', '=', 'enrollments.church_id')
                    ->on('students.id', '=', 'enrollments.student_id');
            })
            ->where('enrollments.church_id', app(TenantContext::class)->churchId())
            ->where('enrollments.ministry_id', $payload['ministry_id'])
            ->whereNull('enrollments.deleted_at')
            ->whereNull('students.deleted_at')
            ->orderBy('enrollments.student_id')
            ->pluck('enrollments.student_id')
            ->all();
        $submitted = $payload['student_ids'];
        sort($submitted);
        if ($submitted !== $expected) {
            throw new SyncResult('rejected', 'roster_changed');
        }

        $session = AttendanceSession::create([
            'id' => $event['entity_id'],
            'church_id' => app(TenantContext::class)->churchId(),
            'ministry_id' => $payload['ministry_id'],
            'attendance_date' => $payload['attendance_date'],
            'status' => AttendanceSessionStatus::Draft,
            'version' => 1,
        ]);
        foreach ($expected as $studentId) {
            AttendanceRecord::create([
                'church_id' => $session->church_id,
                'attendance_session_id' => $session->id,
                'student_id' => $studentId,
                'state' => 'unmarked',
                'version' => 1,
            ]);
        }
        $this->auditAndFeed($event['action'], $session, $actor, $deviceId, $batchId);

        return [$session->id, 1];
    }

    /** @return array{string, int} */
    private function markStudent(array $event, User $actor, string $deviceId, string $batchId): array
    {
        if (! $this->valid($event['payload'], [
            'student_id' => ['required', 'uuid'],
            'state' => ['required', 'in:present,absent'],
        ], ['student_id', 'state'])) {
            throw new SyncResult('rejected', 'invalid_payload');
        }
        $session = $this->editableSession($event, $actor);
        $record = AttendanceRecord::query()
            ->where('church_id', $session->church_id)
            ->where('attendance_session_id', $session->id)
            ->where('student_id', $event['payload']['student_id'])
            ->whereNull('deleted_at')
            ->lockForUpdate()
            ->first();
        if ($record === null) {
            throw new SyncResult('rejected', 'roster_changed', $session->id, (int) $session->version);
        }
        $record->forceFill(['state' => $event['payload']['state'], 'version' => $record->version + 1])->save();
        $session->forceFill(['version' => $session->version + 1])->save();
        $this->auditAndFeed($event['action'], $session, $actor, $deviceId, $batchId);

        return [$session->id, (int) $session->version];
    }

    /** @return array{string, int} */
    private function bulkMark(array $event, User $actor, string $deviceId, string $batchId): array
    {
        if (! $this->valid($event['payload'], [
            'state' => ['required', 'in:present,absent'],
            'student_ids' => ['required', 'array', 'max:500'],
            'student_ids.*' => ['required', 'uuid', 'distinct'],
        ], ['state', 'student_ids'])) {
            throw new SyncResult('rejected', 'invalid_payload');
        }
        $session = $this->editableSession($event, $actor);
        $records = AttendanceRecord::query()
            ->where('church_id', $session->church_id)
            ->where('attendance_session_id', $session->id)
            ->whereIn('student_id', $event['payload']['student_ids'])
            ->whereNull('deleted_at')
            ->lockForUpdate()
            ->get();
        if ($records->count() !== count($event['payload']['student_ids'])) {
            throw new SyncResult('rejected', 'roster_changed', $session->id, (int) $session->version);
        }
        foreach ($records as $record) {
            $record->forceFill(['state' => $event['payload']['state'], 'version' => $record->version + 1])->save();
        }
        $session->forceFill(['version' => $session->version + 1])->save();
        $this->auditAndFeed($event['action'], $session, $actor, $deviceId, $batchId);

        return [$session->id, (int) $session->version];
    }

    /** @return array{string, int} */
    private function finalize(array $event, User $actor, string $deviceId, string $batchId): array
    {
        if ($event['payload'] !== []) {
            throw new SyncResult('rejected', 'invalid_payload');
        }
        $session = $this->editableSession($event, $actor);
        try {
            $session = app(FinalizeAttendance::class)->handle($session->id, $actor, $deviceId, $batchId);
        } catch (AuthorizationException) {
            throw new SyncResult('rejected', 'assignment_revoked', $session->id, (int) $session->version);
        } catch (DomainException $exception) {
            $reason = str_contains($exception->getMessage(), 'unmarked') ? 'incomplete_attendance' : 'roster_changed';
            throw new SyncResult('rejected', $reason, $session->id, (int) $session->version);
        }
        $this->feed($session);

        return [$session->id, (int) $session->version];
    }

    private function editableSession(array $event, User $actor): AttendanceSession
    {
        $session = AttendanceSession::query()
            ->where('church_id', app(TenantContext::class)->churchId())
            ->whereNull('deleted_at')
            ->lockForUpdate()
            ->find($event['entity_id']);
        if ($session === null) {
            throw new SyncResult('rejected', 'record_not_found');
        }
        if ((int) $session->version !== (int) $event['base_version']) {
            throw new SyncResult('conflict', 'version_conflict', $session->id, (int) $session->version);
        }
        if ($session->status !== AttendanceSessionStatus::Draft) {
            throw new SyncResult('conflict', 'record_finalized', $session->id, (int) $session->version);
        }
        if (! (new AttendancePolicy)->update($actor, $session)) {
            throw new SyncResult('rejected', 'assignment_revoked', $session->id, (int) $session->version);
        }

        return $session;
    }

    private function auditAndFeed(string $action, AttendanceSession $session, User $actor, string $deviceId, string $batchId): void
    {
        app(AuditWriter::class)->record(new AuditEntry(
            'church', $action, 'user', (string) $actor->id, 'attendance_session', $session->id,
            'success', $session->church_id, $deviceId, $batchId,
        ));
        $this->feed($session);
    }

    private function feed(AttendanceSession $session): void
    {
        $session->load(['records' => fn ($query) => $query->whereNull('deleted_at')->orderBy('student_id')]);
        ChangeFeedEntry::create([
            'church_id' => $session->church_id,
            'ministry_id' => $session->ministry_id,
            'entity_type' => 'attendance_session',
            'entity_id' => $session->id,
            'entity_version' => $session->version,
            'action' => 'upsert',
            'payload_json' => [
                'id' => $session->id,
                'ministry_id' => $session->ministry_id,
                'attendance_date' => $session->attendance_date->format('Y-m-d'),
                'status' => $session->status->value,
                'version' => $session->version,
                'finalized_at' => $session->finalized_at?->toISOString(),
                'deleted_at' => $session->deleted_at?->toISOString(),
                'records' => $session->records->map(fn (AttendanceRecord $record): array => [
                    'id' => $record->id,
                    'student_id' => $record->student_id,
                    'state' => $record->state->value,
                    'version' => $record->version,
                    'deleted_at' => $record->deleted_at?->toISOString(),
                ])->values()->all(),
            ],
        ]);
    }

    private function valid(array $payload, array $rules, array $allowed): bool
    {
        return array_diff(array_keys($payload), $allowed) === [] && ! Validator::make($payload, $rules)->fails();
    }

    private function auditResult(ChurchMembership $membership, User $actor, string $deviceId, string $batchId, string $status): void
    {
        app(AuditWriter::class)->record(new AuditEntry(
            'church',
            'sync.event.'.$status,
            'user',
            (string) $actor->id,
            'sync_batch',
            $batchId,
            $status === 'rejected' ? 'denied' : 'failure',
            $membership->church_id,
            $deviceId,
            $batchId,
        ));
    }

    private function canonical(mixed $value): mixed
    {
        if (! is_array($value)) {
            return $value;
        }
        if (! array_is_list($value)) {
            ksort($value);
        }

        return array_map(fn (mixed $item): mixed => $this->canonical($item), $value);
    }

    /** @return array<string, mixed> */
    private function response(string $eventId, string $status, ?string $reason = null, ?string $recordId = null, ?int $version = null, ?string $original = null): array
    {
        return array_filter([
            'client_event_id' => $eventId,
            'status' => $status,
            'original_status' => $original,
            'reason' => $reason,
            'record_id' => $recordId,
            'version' => $version,
        ], fn (mixed $value): bool => $value !== null);
    }
}

final class SyncResult extends \RuntimeException
{
    public function __construct(
        public readonly string $status,
        public readonly string $reason,
        public readonly ?string $recordId = null,
        public readonly ?int $version = null,
    ) {
        parent::__construct($reason);
    }
}
