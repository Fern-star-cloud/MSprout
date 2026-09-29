<?php

namespace App\Domain\Audit;

use App\Models\AuditEvent;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;
use LogicException;

class AuditWriter
{
    public function record(AuditEntry $event): void
    {
        AuditEvent::create($this->attributes($event));
    }

    public function attributes(AuditEntry $event): array
    {
        if (! in_array($event->category, ['church', 'platform', 'security'], true)
            || ! in_array($event->actorType, ['user', 'platform_admin', 'system', 'anonymous'], true)
            || ! in_array($event->result, ['success', 'failure', 'denied'], true)
            || ! preg_match('/\A[a-z][a-z0-9_.]{1,63}\z/', $event->action)
            || ! in_array($event->targetType, ['application', 'membership', 'invitation', 'user', 'platform_admin', 'session', 'submission', 'sync_batch', 'sync_conflict', 'ministry', 'student', 'enrollment', 'import_batch', 'attendance_session', 'attendance_record', 'attendance_guest', 'system'], true)) {
            throw new InvalidArgumentException('Invalid audit classification.');
        }
        foreach ([$event->actorId, $event->targetId] as $id) {
            if ($id !== null && ! Str::isUuid($id) && ! preg_match('/\A[0-9]{1,20}\z/', $id)) {
                throw new InvalidArgumentException('Audit identifiers must be internal identifiers.');
            }
        }
        foreach ([$event->churchId, $event->deviceId, $event->syncBatchId, $event->correlationId] as $id) {
            if ($id !== null && ! Str::isUuid($id)) {
                throw new InvalidArgumentException('Invalid audit UUID.');
            }
        }
        if ($event->churchId !== null) {
            // This transaction-local scope is established by authorized membership or signed invitation handling.
            $trusted = DB::selectOne("SELECT NULLIF(current_setting('app.current_church_id', true), '') AS id")->id;
            if ($trusted !== strtolower($event->churchId)) {
                throw new LogicException('Audit tenant scope mismatch.');
            }
        }
        if (($event->category === 'church') !== ($event->churchId !== null) && $event->category !== 'security') {
            throw new LogicException('Invalid audit scope.');
        }
        foreach ($event->metadata as $key => $value) {
            $valid = match ($key) {
                'risk' => in_array($value, ['normal', 'high'], true),
                'decision_category' => in_array($value, ['duplicate', 'ineligible', 'incomplete', 'other'], true),
                'previous_owner_id' => is_string($value) && Str::isUuid($value),
                'applicant_id', 'count', 'result_count' => is_int($value) && $value >= 0,
                'date_from', 'date_to' => is_string($value)
                    && preg_match('/\A\d{4}-\d{2}-\d{2}\z/', $value) === 1,
                'ministry_id' => $value === null || (is_string($value) && Str::isUuid($value)),
                default => false,
            };
            if (! $valid) {
                throw new InvalidArgumentException('Audit metadata is not allowlisted.');
            }
        }

        return [
            'id' => (string) Str::uuid(), 'category' => $event->category, 'church_id' => $event->churchId,
            'actor_type' => $event->actorType, 'actor_id' => $event->actorId,
            'action' => $event->action, 'target_type' => $event->targetType, 'target_id' => $event->targetId,
            'result' => $event->result, 'device_id' => $event->deviceId, 'sync_batch_id' => $event->syncBatchId,
            'correlation_id' => $event->correlationId ?? app(CorrelationContext::class)->id(),
            'metadata_json' => $event->metadata, 'occurred_at' => now('UTC'),
        ];
    }
}
