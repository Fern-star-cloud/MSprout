<?php

namespace App\Domain\Sync;

use App\Domain\Attendance\AttendanceCompatibility;
use App\Enums\ChurchRole;
use App\Models\ChurchMembership;
use Carbon\CarbonImmutable;
use Generator;
use Illuminate\Support\Facades\DB;

/** Authoritative tables, never reconstructed from retained feed payloads. */
final class RecoveryProjection
{
    public function scope(ChurchMembership $member): array
    {
        $q = DB::table('ministries')->where('church_id', $member->church_id);
        if ($member->role === ChurchRole::Teacher) {
            $q->whereNull('archived_at')->whereNull('deleted_at')->whereIn('id', DB::table('teacher_ministry_assignments')
                ->where('church_id', $member->church_id)->where('membership_id', $member->id)
                ->whereNull('revoked_at')->select('ministry_id'));
        }
        $ministries = $q->orderBy('id')->get(['id', 'name', 'version', 'archived_at', 'deleted_at'])->map(fn ($r) => (array) $r)->all();
        $active = array_column(array_filter($ministries, fn ($m) => $m['archived_at'] === null && $m['deleted_at'] === null), 'id');
        $enrollments = DB::table('enrollments')->where('church_id', $member->church_id)
            ->whereIn('ministry_id', $active)->whereNull('deleted_at')->orderBy('student_id')->orderBy('ministry_id')
            ->get(['student_id', 'ministry_id', 'version'])->groupBy('student_id');
        $roster = DB::table('students')->where('church_id', $member->church_id)
            ->whereIn('id', $enrollments->keys())->whereNull('deleted_at')->orderBy('id')->get(['id', 'first_name', 'middle_name', 'last_name', 'preferred_name', 'suffix', 'gender', 'version', 'deleted_at'])
            ->map(fn ($student) => [...$this->student($student), 'enrollments' => $enrollments[$student->id]->map(fn ($e) => ['ministry_id' => $e->ministry_id, 'version' => $e->version])->all()])->all();
        $scope = ['actor_id' => (string) $member->user_id, 'membership_id' => $member->id, 'role' => $member->role->value,
            'timezone' => DB::table('churches')->where('id', $member->church_id)->value('timezone'), 'ministries' => $ministries, 'roster' => $roster];
        [$scope['window_start'], $scope['window_end']] = $this->currentWindow($scope['timezone']);

        return [...$scope, 'ministry_ids' => array_column($ministries, 'id'), 'digest' => RecoveryCodec::digest($scope)];
    }

    private function student(object $s): array
    {
        return ['id' => $s->id, 'display_name' => $s->preferred_name ?: trim($s->first_name.' '.($s->middle_name ? $s->middle_name.' ' : '').$s->last_name.($s->suffix ? ' '.$s->suffix : '')),
            'gender' => $s->gender, 'version' => $s->version, 'deleted_at' => $s->deleted_at];
    }

    public function window(array $scope): array
    {
        return [$scope['window_start'], $scope['window_end']];
    }

    public function assertCurrent(array $scope): void
    {
        if ($this->window($scope) !== $this->currentWindow($scope['timezone'])) {
            throw new RecoveryException('recovery_scope_changed');
        }
    }

    private function currentWindow(string $timezone): array
    {
        // Wall clock, not the transaction-start timestamp: a long seal can cross midnight.
        $today = CarbonImmutable::parse(DB::scalar('SELECT clock_timestamp() AS recovery_scope_clock'))
            ->setTimezone($timezone)->startOfDay();

        return [$today->subDays(89)->toDateString(), $today->toDateString()];
    }

    /** Every session has a header and typed child fragments with exact counts. */
    public function items(string $church, array $scope, array $references, array $window): Generator
    {
        yield ['type' => 'scope', 'id' => $scope['membership_id'], 'actor_id' => $scope['actor_id'], 'role' => $scope['role'], 'timezone' => $scope['timezone']];
        foreach ($scope['ministries'] as $ministry) {
            yield ['type' => 'ministry', ...$ministry];
        }
        foreach ($scope['roster'] as $student) {
            yield ['type' => 'roster_student', ...$student];
        }
        $ids = array_keys($references);
        $sessions = DB::table('attendance_sessions')->where('church_id', $church)->whereIn('ministry_id', $scope['ministry_ids'])
            ->where('attendance_date', '<=', $window[1])
            ->where(fn ($q) => $q->whereBetween('attendance_date', $window)->orWhereIn('id', $ids))->orderBy('id');
        $found = [];
        foreach ($sessions->lazyById(100)->chunk(100) as $batch) {
            $batchIds = $batch->pluck('id')->all();
            $batchRecords = DB::table('attendance_records')->where('church_id', $church)->whereIn('attendance_session_id', $batchIds)->orderBy('id')->get()->groupBy('attendance_session_id');
            $batchRevisions = DB::table('attendance_revisions')->where('church_id', $church)->whereIn('attendance_session_id', $batchIds)->orderBy('revised_at')->orderBy('id')->get()->groupBy('attendance_session_id');
            $batchGuests = DB::table('attendance_guests')->where('church_id', $church)->whereIn('attendance_session_id', $batchIds)->orderBy('id')->get()->groupBy('attendance_session_id');
            $batchConflicts = DB::table('sync_conflicts')->where('church_id', $church)->whereIn('attendance_session_id', $batchIds)->orderBy('id')->get()->groupBy('attendance_session_id');
            $studentIds = $batchRecords->flatten(1)->pluck('student_id')->merge($batchGuests->flatten(1)->pluck('resolved_student_id'))->filter()->unique();
            $batchStudents = DB::table('students')->where('church_id', $church)->whereIn('id', $studentIds)->get(['id', 'first_name', 'middle_name', 'last_name', 'preferred_name', 'suffix', 'gender', 'version', 'deleted_at'])->keyBy('id');
            app(AttendanceCompatibility::class)->sessions($batchIds);
            foreach ($batch as $session) {
                if (isset($references[$session->id])) {
                    $found[$session->id] = true;
                }
                $records = $batchRecords->get($session->id, collect());
                $revisions = $batchRevisions->get($session->id, collect());
                $guests = $batchGuests->get($session->id, collect());
                $conflicts = $batchConflicts->get($session->id, collect());
                $students = $batchStudents->only($records->pluck('student_id')->merge($guests->pluck('resolved_student_id'))->filter()->unique()->all())->sortKeys();
                $latest = $revisions->keyBy('attendance_record_id');
                $recordIds = $records->pluck('id')->flip();
                $guestIds = $guests->pluck('id')->flip();
                $conflictIds = $conflicts->pluck('id')->flip();
                // Reject corrupt or unsupported authoritative graphs before exposing any page.
                foreach ($revisions as $revision) {
                    if (! isset($recordIds[$revision->attendance_record_id]) || ($revision->sync_conflict_id !== null && ! isset($conflictIds[$revision->sync_conflict_id]))) {
                        throw new RecoveryException('recovery_integrity_failed');
                    }
                }
                foreach ($conflicts as $conflict) {
                    if ($conflict->attendance_record_id !== null && ! isset($recordIds[$conflict->attendance_record_id])) {
                        throw new RecoveryException('recovery_integrity_failed');
                    }
                }
                foreach ($guests as $guest) {
                    if (($guest->merged_into_guest_id !== null && ! isset($guestIds[$guest->merged_into_guest_id]))
                        || ($guest->resolved_student_id !== null && ! isset($students[$guest->resolved_student_id]))) {
                        throw new RecoveryException('recovery_integrity_failed');
                    }
                }
                yield ['type' => 'session', 'id' => $session->id, 'ministry_id' => $session->ministry_id, 'attendance_date' => $session->attendance_date,
                    'status' => $session->status, 'version' => $session->version, 'finalized_at' => $session->finalized_at, 'deleted_at' => $session->deleted_at,
                    'fragment_counts' => ['records' => $records->count(), 'revisions' => $revisions->count(), 'guests' => $guests->count(), 'conflicts' => $conflicts->count(), 'students' => $students->count()]];
                foreach ($students as $student) {
                    yield ['type' => 'historical_student', ...$this->student($student), 'id' => $session->id.':'.$student->id, 'session_id' => $session->id, 'student_id' => $student->id];
                }
                foreach ($records as $record) {
                    if (! isset($students[$record->student_id]) || ($record->source_guest_id !== null && ! isset($guestIds[$record->source_guest_id]))) {
                        throw new RecoveryException('recovery_integrity_failed');
                    }
                    yield ['type' => 'record', 'id' => $record->id, 'session_id' => $session->id, 'student_id' => $record->student_id,
                        'original_state' => $record->state, 'state' => $latest->get($record->id)?->after_state ?? $record->state,
                        'version' => $record->version, 'source_guest_id' => $record->source_guest_id, 'deleted_at' => $record->deleted_at,
                        'recorded_at' => $record->recorded_at, 'received_at' => $record->recorded_received_at];
                }
                foreach ($revisions as $revision) {
                    yield ['type' => 'revision', 'id' => $revision->id, 'session_id' => $session->id, 'record_id' => $revision->attendance_record_id,
                        'conflict_id' => $revision->sync_conflict_id, 'before_state' => $revision->before_state, 'after_state' => $revision->after_state, 'revised_at' => $revision->revised_at];
                }
                foreach ($guests as $guest) {
                    yield ['type' => 'guest', 'id' => $guest->id, 'session_id' => $session->id, 'display_name' => $guest->display_name, 'gender' => $guest->gender,
                        'state' => $guest->state, 'status' => $guest->status, 'resolved_student_id' => $guest->resolved_student_id,
                        'merged_into_guest_id' => $guest->merged_into_guest_id, 'occurred_at' => $guest->occurred_at, 'received_at' => $guest->received_at, 'resolved_at' => $guest->resolved_at];
                }
                foreach ($conflicts as $conflict) {
                    $existing = json_decode($conflict->existing_value, true, flags: JSON_THROW_ON_ERROR);
                    $incoming = json_decode($conflict->incoming_value, true, flags: JSON_THROW_ON_ERROR);
                    // No arbitrary payloads, actor identities, device IDs or audit/free-form text.
                    yield ['type' => 'conflict', 'id' => $conflict->id, 'session_id' => $session->id, 'record_id' => $conflict->attendance_record_id,
                        'incoming_event_id' => $conflict->incoming_event_id, 'field' => $conflict->field, 'base_version' => $conflict->base_version,
                        'existing' => array_intersect_key($existing, array_flip(['state', 'status', 'version'])), 'incoming' => array_intersect_key($incoming, array_flip(['state', 'status', 'version'])),
                        'was_finalized' => $conflict->was_finalized, 'status' => $conflict->status, 'resolution' => $conflict->resolution,
                        'existing_occurred_at' => $conflict->existing_occurred_at, 'incoming_occurred_at' => $conflict->incoming_occurred_at,
                        'existing_received_at' => $conflict->existing_received_at, 'incoming_received_at' => $conflict->incoming_received_at, 'resolved_at' => $conflict->resolved_at];
                }
            }
        }
        foreach ($ids as $id) {
            yield ['type' => 'reference', 'id' => $id, 'availability' => isset($found[$id]) ? 'included' : 'unavailable'];
        }
    }
}
