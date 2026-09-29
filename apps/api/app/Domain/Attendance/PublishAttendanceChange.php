<?php

namespace App\Domain\Attendance;

use App\Models\AttendanceGuest;
use App\Models\AttendanceRecord;
use App\Models\AttendanceRevision;
use App\Models\AttendanceSession;
use App\Models\ChangeFeedEntry;

final class PublishAttendanceChange
{
    public function handle(AttendanceSession $session): void
    {
        $records = AttendanceRecord::query()
            ->where('church_id', $session->church_id)
            ->where('attendance_session_id', $session->id)
            ->whereNull('deleted_at')
            ->orderBy('student_id')
            ->get();
        $latest = AttendanceRevision::query()
            ->where('church_id', $session->church_id)
            ->whereIn('attendance_record_id', $records->pluck('id'))
            ->orderBy('revised_at')
            ->orderBy('id')
            ->get()
            ->keyBy('attendance_record_id');
        $guests = AttendanceGuest::query()
            ->where('church_id', $session->church_id)
            ->where('attendance_session_id', $session->id)
            ->orderBy('occurred_at')
            ->orderBy('id')
            ->get();

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
                'records' => $records->map(function (AttendanceRecord $record) use ($latest): array {
                    $revision = $latest->get($record->id);

                    return [
                        'id' => $record->id,
                        'student_id' => $record->student_id,
                        'state' => $revision?->after_state ?? $record->state->value,
                        'version' => $record->version,
                        'deleted_at' => $record->deleted_at?->toISOString(),
                    ];
                })->values()->all(),
                'guests' => $guests->map(fn (AttendanceGuest $guest): array => [
                    'id' => $guest->id,
                    'display_name' => $guest->display_name,
                    'gender' => $guest->gender,
                    'state' => $guest->state,
                    'status' => $guest->status,
                    'resolved_student_id' => $guest->resolved_student_id,
                    'merged_into_guest_id' => $guest->merged_into_guest_id,
                ])->values()->all(),
            ],
        ]);
    }
}
