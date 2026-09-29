<?php

namespace App\Domain\Reports;

use App\Enums\ChurchRole;
use App\Models\ChurchMembership;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class AttendanceSummary
{
    /**
     * @param  array{date_from: string, date_to: string, ministry_id: ?string}  $filters
     */
    public function report(User $actor, array $filters): array
    {
        $finalizedSessions = $this->sessions($actor, $filters, ['finalized', 'revised']);
        $recordCounts = $this->recordCounts();
        $revisionCounts = DB::table('attendance_revisions')
            ->select('attendance_session_id')->selectRaw('COUNT(*) AS correction_count')
            ->where('church_id', app(TenantContext::class)->churchId())
            ->groupBy('attendance_session_id');

        $sessions = $finalizedSessions
            ->leftJoinSub($recordCounts, 'record_counts', 'record_counts.attendance_session_id', '=', 'attendance_sessions.id')
            ->leftJoinSub($revisionCounts, 'revision_counts', 'revision_counts.attendance_session_id', '=', 'attendance_sessions.id')
            ->select([
                'attendance_sessions.id', 'attendance_sessions.ministry_id', 'ministries.name as ministry_name',
                'attendance_sessions.attendance_date', 'attendance_sessions.status', 'attendance_sessions.finalized_at',
            ])
            ->selectRaw('COALESCE(record_counts.present_count, 0) AS present_count')
            ->selectRaw('COALESCE(record_counts.absent_count, 0) AS absent_count')
            ->selectRaw('COALESCE(revision_counts.correction_count, 0) AS correction_count')
            ->orderByDesc('attendance_sessions.attendance_date')
            ->orderByDesc('attendance_sessions.finalized_at')
            ->orderBy('attendance_sessions.id')
            ->limit(100)
            ->get()
            ->map(function (object $session): array {
                $present = (int) $session->present_count;
                $absent = (int) $session->absent_count;

                return [
                    'id' => $session->id,
                    'ministry_id' => $session->ministry_id,
                    'ministry_name' => $session->ministry_name,
                    'attendance_date' => (string) $session->attendance_date,
                    'status' => $session->status,
                    'finalized_at' => Carbon::parse($session->finalized_at)->utc()->toISOString(),
                    'present_count' => $present,
                    'absent_count' => $absent,
                    'attendance_rate' => $this->rate($present, $absent),
                    'correction_count' => (int) $session->correction_count,
                ];
            })->values()->all();

        $totals = $this->sessions($actor, $filters, ['finalized', 'revised'])
            ->joinSub($recordCounts, 'record_counts', 'record_counts.attendance_session_id', '=', 'attendance_sessions.id')
            ->selectRaw('COALESCE(SUM(record_counts.present_count), 0) AS present_count')
            ->selectRaw('COALESCE(SUM(record_counts.absent_count), 0) AS absent_count')
            ->first();
        $present = (int) ($totals->present_count ?? 0);
        $absent = (int) ($totals->absent_count ?? 0);
        $eligibleSessionIds = $this->sessions($actor, $filters, null)->select('attendance_sessions.id');
        $pending = $this->sessions($actor, $filters, ['draft', 'finalized_pending'])->count();
        $conflicts = DB::table('sync_conflicts')->where('church_id', app(TenantContext::class)->churchId())
            ->where('status', 'open')->whereIn('attendance_session_id', clone $eligibleSessionIds)->count();
        $corrections = DB::table('attendance_revisions')->where('church_id', app(TenantContext::class)->churchId())
            ->whereIn('attendance_session_id', clone $eligibleSessionIds)->count();
        $role = app(TenantContext::class)->role();

        return [
            'role' => $role->value,
            'can_export' => $role === ChurchRole::Owner,
            'filters' => $filters,
            'summary' => [
                'present_count' => $present,
                'absent_count' => $absent,
                'finalized_record_count' => $present + $absent,
                'attendance_rate' => $this->rate($present, $absent),
                'pending_count' => $pending,
                'conflict_count' => $conflicts,
                'correction_count' => $corrections,
            ],
            'sessions' => $sessions,
        ];
    }

    /**
     * @param  array{date_from: string, date_to: string, ministry_id: ?string}  $filters
     * @return array<int, array<string, bool|string>>
     */
    public function exportRows(User $actor, array $filters): array
    {
        $effectiveState = $this->effectiveState('attendance_records');
        $sessionIds = $this->sessions($actor, $filters, ['finalized', 'revised'])->select('attendance_sessions.id');

        return DB::table('attendance_records')
            ->join('attendance_sessions', function ($join): void {
                $join->on('attendance_sessions.church_id', '=', 'attendance_records.church_id')
                    ->on('attendance_sessions.id', '=', 'attendance_records.attendance_session_id');
            })
            ->join('ministries', function ($join): void {
                $join->on('ministries.church_id', '=', 'attendance_sessions.church_id')
                    ->on('ministries.id', '=', 'attendance_sessions.ministry_id');
            })
            ->join('students', function ($join): void {
                $join->on('students.church_id', '=', 'attendance_records.church_id')
                    ->on('students.id', '=', 'attendance_records.student_id');
            })
            ->where('attendance_records.church_id', app(TenantContext::class)->churchId())
            ->whereNull('attendance_records.deleted_at')
            ->whereIn('attendance_records.attendance_session_id', $sessionIds)
            ->select([
                'attendance_sessions.attendance_date', 'attendance_sessions.status', 'attendance_sessions.finalized_at',
                'ministries.name as ministry_name', 'students.first_name', 'students.middle_name',
                'students.last_name', 'students.preferred_name', 'students.suffix',
            ])
            ->selectRaw("{$effectiveState} AS effective_state")
            ->selectRaw('EXISTS (SELECT 1 FROM attendance_revisions revision_check WHERE revision_check.church_id = attendance_records.church_id AND revision_check.attendance_record_id = attendance_records.id) AS corrected')
            ->orderBy('attendance_sessions.attendance_date')
            ->orderBy('ministries.name')
            ->orderBy('students.last_name')
            ->orderBy('students.first_name')
            ->orderBy('attendance_records.id')
            ->get()
            ->map(fn (object $row): array => [
                'attendance_date' => (string) $row->attendance_date,
                'ministry' => $row->ministry_name,
                'student' => $row->preferred_name ?: trim(implode(' ', array_filter([
                    $row->first_name, $row->middle_name, $row->last_name, $row->suffix,
                ], fn ($value): bool => is_string($value) && $value !== ''))),
                'effective_state' => $row->effective_state,
                'session_status' => $row->status,
                'corrected' => (bool) $row->corrected,
                'finalized_at' => Carbon::parse($row->finalized_at)->utc()->toISOString(),
            ])->values()->all();
    }

    /**
     * @param  array{date_from: string, date_to: string, ministry_id: ?string}  $filters
     * @param  array<int, string>|null  $statuses
     */
    private function sessions(User $actor, array $filters, ?array $statuses): Builder
    {
        $churchId = app(TenantContext::class)->churchId();
        $query = DB::table('attendance_sessions')
            ->join('ministries', function ($join): void {
                $join->on('ministries.church_id', '=', 'attendance_sessions.church_id')
                    ->on('ministries.id', '=', 'attendance_sessions.ministry_id');
            })
            ->where('attendance_sessions.church_id', $churchId)
            ->whereBetween('attendance_sessions.attendance_date', [$filters['date_from'], $filters['date_to']])
            ->whereNull('attendance_sessions.deleted_at');
        if ($statuses !== null) {
            $query->whereIn('attendance_sessions.status', $statuses);
        }
        if ($filters['ministry_id'] !== null) {
            $query->where('attendance_sessions.ministry_id', $filters['ministry_id']);
        }
        if (app(TenantContext::class)->role() === ChurchRole::Teacher) {
            $membershipId = ChurchMembership::query()
                ->where('church_id', $churchId)->where('user_id', $actor->id)->where('status', 'active')->value('id');
            $query->whereExists(function (Builder $assignment) use ($churchId, $membershipId): void {
                $assignment->selectRaw('1')->from('teacher_ministry_assignments')
                    ->whereColumn('teacher_ministry_assignments.ministry_id', 'attendance_sessions.ministry_id')
                    ->where('teacher_ministry_assignments.church_id', $churchId)
                    ->where('teacher_ministry_assignments.membership_id', $membershipId)
                    ->whereNull('teacher_ministry_assignments.revoked_at');
            });
        }

        return $query;
    }

    private function recordCounts(): Builder
    {
        $effectiveState = $this->effectiveState('attendance_records');

        return DB::table('attendance_records')
            ->where('attendance_records.church_id', app(TenantContext::class)->churchId())
            ->whereNull('attendance_records.deleted_at')
            ->select('attendance_records.attendance_session_id')
            ->selectRaw("COUNT(*) FILTER (WHERE {$effectiveState} = 'present') AS present_count")
            ->selectRaw("COUNT(*) FILTER (WHERE {$effectiveState} = 'absent') AS absent_count")
            ->groupBy('attendance_records.attendance_session_id');
    }

    private function effectiveState(string $recordAlias): string
    {
        return "COALESCE((SELECT revision.after_state FROM attendance_revisions revision WHERE revision.church_id = {$recordAlias}.church_id AND revision.attendance_record_id = {$recordAlias}.id ORDER BY revision.revised_at DESC, revision.id DESC LIMIT 1), {$recordAlias}.state)";
    }

    private function rate(int $present, int $absent): float
    {
        $total = $present + $absent;

        return $total === 0 ? 0.0 : $present / $total;
    }
}
