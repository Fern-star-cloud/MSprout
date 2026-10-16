<?php

namespace App\Domain\Attendance;

use App\Models\AttendanceSession;
use App\Models\SyncConflict;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class AttendanceCompatibility
{
    public const HEADER = 'X-MSprout-Attendance-Reader';

    public function declaration(Request $request): void
    {
        if (! $request->headers->has(self::HEADER)) {
            return;
        }
        $values = $request->headers->all(self::HEADER);
        if (count($values) !== 1 || ! is_string($values[0]) || ! preg_match('/\A[a-z][a-z0-9]*(?:-[a-z0-9]+)*\z/', $values[0]) || strlen($values[0]) > 64) {
            throw new AttendanceCompatibilityException('invalid_attendance_reader');
        }
        if ($values[0] !== 'three-state-v1') {
            throw new AttendanceCompatibilityException('unsupported_attendance_reader');
        }
    }

    public function state(mixed $value, array $supported = ['unmarked', 'present', 'absent']): void
    {
        if (! in_array($value, $supported, true)) {
            throw new AttendanceCompatibilityException;
        }
    }

    public function changes(array $changes): void
    {
        foreach ($changes as $change) {
            if ($change['entity_type'] === 'ministry_assignment' && $change['action'] === 'tombstone'
                && is_array($change['payload']) && ($change['payload']['ministry_id'] ?? null) === $change['ministry_id']) {
                continue;
            }
            if ($change['entity_type'] !== 'attendance_session' || $change['action'] !== 'upsert' || ! is_array($change['payload'])) {
                throw new AttendanceCompatibilityException;
            }
            $payload = $change['payload'];
            $this->representation($payload, $change);
            $this->state($payload['status'] ?? null, ['draft', 'finalized_pending', 'finalized', 'needs_review', 'revised']);
            if (! is_array($payload['records'] ?? null) || (isset($payload['guests']) && ! is_array($payload['guests']))) {
                throw new AttendanceCompatibilityException;
            }
            foreach ($payload['records'] as $record) {
                $this->state(is_array($record) ? ($record['state'] ?? null) : null);
            }
            foreach ($payload['guests'] ?? [] as $guest) {
                $this->state(is_array($guest) ? ($guest['state'] ?? null) : null, ['present']);
                $this->state($guest['status'] ?? null, ['pending', 'promoted', 'linked', 'merged']);
            }
        }
        // Check encoding before progress writes; never stream a partial page.
        json_encode($changes, JSON_THROW_ON_ERROR);
    }

    private function representation(array $payload, array $change): void
    {
        $rules = [
            'id' => ['required', 'uuid'], 'ministry_id' => ['required', 'uuid'],
            'attendance_date' => ['required', 'date_format:Y-m-d'], 'version' => ['required', 'integer', 'min:1'],
            'records' => ['present', 'array'], 'guests' => ['present', 'array'],
            'records.*' => ['required', 'array'], 'records.*.id' => ['required', 'uuid', 'distinct'],
            'records.*.student_id' => ['required', 'uuid', 'distinct'], 'records.*.version' => ['required', 'integer', 'min:1'],
            'guests.*' => ['required', 'array'], 'guests.*.id' => ['required', 'uuid', 'distinct'],
            'guests.*.display_name' => ['required', 'string', 'min:1', 'max:120'],
            'guests.*.gender' => ['required', 'in:male,female,unspecified'],
            'guests.*.resolved_student_id' => ['sometimes', 'nullable', 'uuid'],
            'guests.*.merged_into_guest_id' => ['sometimes', 'nullable', 'uuid'],
            'finalized_by' => ['sometimes', 'nullable', 'integer', 'min:1'],
        ];
        if (Validator::make($payload, $rules)->fails() || $payload['id'] !== $change['entity_id']
            || $payload['ministry_id'] !== $change['ministry_id'] || $payload['version'] !== $change['version']
            || (array_key_exists('church_id', $payload) && $payload['church_id'] !== app(TenantContext::class)->churchId())
            || ($payload['deleted_at'] ?? null) !== null) {
            throw new AttendanceCompatibilityException;
        }
        foreach (['finalized_at'] as $field) {
            if (isset($payload[$field]) && (! is_string($payload[$field])
                || ! preg_match('/\A\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})\z/', $payload[$field])
                || ! Validator::make([$field => $payload[$field]], [$field => ['date']])->passes())) {
                throw new AttendanceCompatibilityException;
            }
        }
        foreach ($payload['records'] as $record) {
            if (! is_int($record['version']) || ($record['deleted_at'] ?? null) !== null) {
                throw new AttendanceCompatibilityException;
            }
        }
    }

    public function conflict(SyncConflict $conflict): void
    {
        foreach ([$conflict->existing_value, $conflict->incoming_value] as $value) {
            $this->state(is_array($value) ? ($value['state'] ?? null) : null, ['present', 'absent']);
        }
    }

    public function session(AttendanceSession $session): void
    {
        $this->sessions([$session->id]);
    }

    /** Call only with an already-authorized, locked session scope. Read raw values before enum casts. */
    public function sessions(array $ids): void
    {
        if ($ids === []) {
            return;
        }
        $church = app(TenantContext::class)->churchId();
        foreach (DB::table('attendance_sessions')->where('church_id', $church)->whereIn('id', $ids)->pluck('status') as $status) {
            $this->state($status, ['draft', 'finalized_pending', 'finalized', 'needs_review', 'revised']);
        }
        $records = DB::table('attendance_records')->where('church_id', $church)->whereIn('attendance_session_id', $ids)
            ->whereNull('deleted_at')->selectRaw('COALESCE((SELECT revision.after_state FROM attendance_revisions revision WHERE revision.church_id = attendance_records.church_id AND revision.attendance_record_id = attendance_records.id ORDER BY revision.revised_at DESC, revision.id DESC LIMIT 1), attendance_records.state) AS effective_state')->get();
        foreach ($records as $record) {
            $this->state($record->effective_state);
        }
        foreach (DB::table('attendance_guests')->where('church_id', $church)->whereIn('attendance_session_id', $ids)->pluck('state') as $state) {
            $this->state($state, ['present']);
        }
        foreach (SyncConflict::query()->where('church_id', $church)->whereIn('attendance_session_id', $ids)->where('status', 'open')->get() as $conflict) {
            $this->conflict($conflict);
        }
    }
}
