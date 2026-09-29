<?php

namespace App\Domain\Sync;

use App\Domain\Attendance\DetectAttendanceConflict;
use App\Domain\Attendance\FinalizeAttendance;
use App\Domain\Attendance\PublishAttendanceChange;
use App\Domain\Audit\AuditEntry;
use App\Domain\Audit\AuditWriter;
use App\Domain\Audit\CorrelationContext;
use App\Enums\AttendanceSessionStatus;
use App\Models\AttendanceGuest;
use App\Models\AttendanceRecord;
use App\Models\AttendanceRevision;
use App\Models\AttendanceSession;
use App\Models\ChurchMembership;
use App\Models\Enrollment;
use App\Models\SyncConflict;
use App\Models\SyncEvent;
use App\Models\User;
use App\Policies\AttendancePolicy;
use App\Support\Tenancy\TenantContext;
use Carbon\CarbonImmutable;
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
            'attendance.guest_added' => $this->addGuest($event, $actor, $deviceId, $batchId),
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
            'student_ids' => ['present', 'array', 'max:500'],
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
        $session = AttendanceSession::query()
            ->where('church_id', app(TenantContext::class)->churchId())
            ->whereNull('deleted_at')
            ->lockForUpdate()
            ->find($event['entity_id']);
        if ($session === null) {
            throw new SyncResult('rejected', 'record_not_found');
        }
        if (! (new AttendancePolicy)->view($actor, $session)) {
            throw new SyncResult('rejected', 'assignment_revoked', $session->id, (int) $session->version);
        }
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
        if ((int) $event['base_version'] === 0 || (int) $event['base_version'] > (int) $session->version) {
            throw new SyncResult('conflict', 'version_conflict', $session->id, (int) $session->version);
        }
        $existing = $this->effectiveState($record);
        $finalized = $session->status !== AttendanceSessionStatus::Draft;
        $classification = app(DetectAttendanceConflict::class)->classify(
            'state', (int) $event['base_version'], (int) $session->version,
            $existing['state'], $event['payload']['state'], $finalized,
        );
        if ($classification === DetectAttendanceConflict::REVIEW) {
            $now = now('UTC');
            SyncConflict::create([
                'church_id' => $session->church_id,
                'attendance_session_id' => $session->id,
                'attendance_record_id' => $record->id,
                'incoming_event_id' => $event['client_event_id'],
                'field' => 'state', 'base_version' => $event['base_version'],
                'existing_value' => ['state' => $existing['state']],
                'incoming_value' => ['state' => $event['payload']['state']],
                'existing_actor_id' => $existing['actor_id'],
                'incoming_actor_id' => $actor->id,
                'existing_device_id' => $existing['device_id'],
                'incoming_device_id' => $deviceId,
                'existing_correlation_id' => $existing['correlation_id'],
                'incoming_correlation_id' => app(CorrelationContext::class)->id(),
                'existing_occurred_at' => $existing['occurred_at'],
                'existing_received_at' => $existing['received_at'],
                'incoming_occurred_at' => CarbonImmutable::parse($event['occurred_at'])->utc(),
                'incoming_received_at' => $now,
                'was_finalized' => $session->finalized_at !== null,
                'status' => 'open',
            ]);
            $session->forceFill(['status' => AttendanceSessionStatus::NeedsReview, 'version' => $session->version + 1])->save();
            $this->feed($session);
            throw new SyncResult('conflict', 'attendance_conflict', $session->id, (int) $session->version);
        }
        if ($classification === DetectAttendanceConflict::DEDUPLICATE) {
            return [$session->id, (int) $session->version];
        }
        $receivedAt = now('UTC');
        $record->forceFill([
            'state' => $event['payload']['state'], 'version' => $record->version + 1,
            'recorded_by' => $actor->id, 'recorded_device_id' => $deviceId,
            'recorded_correlation_id' => app(CorrelationContext::class)->id(),
            'recorded_at' => CarbonImmutable::parse($event['occurred_at'])->utc(),
            'recorded_received_at' => $receivedAt,
        ])->save();
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
            $record->forceFill([
                'state' => $event['payload']['state'], 'version' => $record->version + 1,
                'recorded_by' => $actor->id, 'recorded_device_id' => $deviceId,
                'recorded_correlation_id' => app(CorrelationContext::class)->id(),
                'recorded_at' => CarbonImmutable::parse($event['occurred_at'])->utc(),
                'recorded_received_at' => now('UTC'),
            ])->save();
        }
        $session->forceFill(['version' => $session->version + 1])->save();
        $this->auditAndFeed($event['action'], $session, $actor, $deviceId, $batchId);

        return [$session->id, (int) $session->version];
    }

    /** @return array{string, int} */
    private function addGuest(array $event, User $actor, string $deviceId, string $batchId): array
    {
        if (! $this->valid($event['payload'], [
            'display_name' => ['required', 'string', 'max:120'],
            'gender' => ['sometimes', 'in:male,female,unspecified'],
        ], ['display_name', 'gender'])) {
            throw new SyncResult('rejected', 'invalid_payload');
        }
        $displayName = trim((string) preg_replace('/[\s\p{Z}]+/u', ' ', $event['payload']['display_name']));
        if ($displayName === '') {
            throw new SyncResult('rejected', 'invalid_payload');
        }
        $session = AttendanceSession::query()
            ->where('church_id', app(TenantContext::class)->churchId())
            ->whereNull('deleted_at')->lockForUpdate()->find($event['entity_id']);
        if ($session === null) {
            throw new SyncResult('rejected', 'record_not_found');
        }
        if (! (new AttendancePolicy)->update($actor, $session)) {
            throw new SyncResult(
                (new AttendancePolicy)->view($actor, $session) ? 'conflict' : 'rejected',
                (new AttendancePolicy)->view($actor, $session) ? 'record_finalized' : 'assignment_revoked',
                $session->id,
                (int) $session->version,
            );
        }
        $existing = AttendanceGuest::query()->where('church_id', $session->church_id)->find($event['client_event_id']);
        if ($existing !== null) {
            if ($existing->attendance_session_id === $session->id
                && $existing->display_name === $displayName
                && $existing->gender === ($event['payload']['gender'] ?? 'unspecified')) {
                return [$session->id, (int) $session->version];
            }
            throw new SyncResult('rejected', 'event_mismatch', $session->id, (int) $session->version);
        }
        AttendanceGuest::create([
            'id' => $event['client_event_id'], 'church_id' => $session->church_id,
            'attendance_session_id' => $session->id, 'display_name' => $displayName,
            'gender' => $event['payload']['gender'] ?? 'unspecified', 'state' => 'present', 'status' => 'pending',
            'created_by' => $actor->id, 'source_device_id' => $deviceId,
            'source_correlation_id' => app(CorrelationContext::class)->id(),
            'occurred_at' => CarbonImmutable::parse($event['occurred_at'])->utc(),
            'received_at' => now('UTC'),
        ]);
        $session->forceFill(['version' => $session->version + 1])->save();
        $this->auditAndFeed('attendance.guest_added', $session, $actor, $deviceId, $batchId);

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
        app(PublishAttendanceChange::class)->handle($session);
    }

    /** @return array{state: string, actor_id: int|null, device_id: string|null, correlation_id: string|null, occurred_at: mixed, received_at: mixed} */
    private function effectiveState(AttendanceRecord $record): array
    {
        $revision = AttendanceRevision::query()
            ->where('church_id', $record->church_id)
            ->where('attendance_record_id', $record->id)
            ->latest('revised_at')->latest('id')->first();

        if ($revision !== null) {
            return [
                'state' => $revision->after_state,
                'actor_id' => $revision->resolving_actor_id,
                'device_id' => null,
                'correlation_id' => null,
                'occurred_at' => null,
                'received_at' => $revision->revised_at,
            ];
        }

        return [
            'state' => $record->state->value,
            'actor_id' => $record->recorded_by,
            'device_id' => $record->recorded_device_id,
            'correlation_id' => $record->recorded_correlation_id,
            'occurred_at' => $record->recorded_at,
            'received_at' => $record->recorded_received_at,
        ];
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
