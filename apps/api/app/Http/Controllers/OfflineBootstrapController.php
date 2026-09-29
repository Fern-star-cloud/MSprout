<?php

namespace App\Http\Controllers;

use App\Actions\Devices\IssueOfflineAuthorization;
use App\Enums\ChurchRole;
use App\Models\ChangeFeedEntry;
use App\Models\Church;
use App\Models\ChurchMembership;
use App\Models\Enrollment;
use App\Models\Ministry;
use App\Models\Student;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class OfflineBootstrapController extends Controller
{
    public function __invoke(Request $request, IssueOfflineAuthorization $issue): JsonResponse
    {
        abort_if(array_diff(array_keys($request->query()), ['device_id']) !== [] || $request->allFiles() !== [], 422);
        $deviceId = $request->validate(['device_id' => ['required', 'uuid']])['device_id'];
        $churchId = app(TenantContext::class)->churchId();
        $membership = ChurchMembership::query()
            ->where('church_id', $churchId)
            ->where('user_id', $request->user()->id)
            ->where('status', 'active')
            ->firstOrFail();

        $ministryQuery = Ministry::query()
            ->where('church_id', $churchId)
            ->whereNull('archived_at')
            ->whereNull('deleted_at');
        if ($membership->role === ChurchRole::Teacher) {
            $ministryQuery->whereIn('id', DB::table('teacher_ministry_assignments')
                ->select('ministry_id')
                ->where('church_id', $churchId)
                ->where('membership_id', $membership->id)
                ->whereNull('revoked_at'));
        }
        $ministries = $ministryQuery->orderBy('name')->orderBy('id')->get(['id', 'name', 'version']);
        $ministryIds = $ministries->pluck('id')->all();

        $enrollments = Enrollment::query()
            ->where('church_id', $churchId)
            ->whereIn('ministry_id', $ministryIds)
            ->whereNull('deleted_at')
            ->get(['student_id', 'ministry_id'])
            ->groupBy('student_id');
        $students = Student::query()
            ->where('church_id', $churchId)
            ->whereIn('id', $enrollments->keys())
            ->whereNull('deleted_at')
            ->orderBy('last_name')->orderBy('first_name')->orderBy('id')
            ->get();
        $timezone = Church::whereKey($churchId)->value('timezone');
        $today = now(is_string($timezone) ? $timezone : 'UTC');
        $todayMonthDay = $today->format('m-d');

        $roster = $students->map(function (Student $student) use ($enrollments, $today, $todayMonthDay): array {
            $birthMonthDay = $student->date_of_birth?->format('m-d');
            $birthdayYear = $birthMonthDay !== null && $birthMonthDay < $todayMonthDay ? $today->year + 1 : $today->year;
            $displayName = $student->preferred_name ?: trim($student->first_name.' '.($student->middle_name ? $student->middle_name.' ' : '').$student->last_name.($student->suffix ? ' '.$student->suffix : ''));

            return [
                'id' => $student->id,
                'display_name' => $displayName,
                'gender' => $student->gender,
                'version' => $student->version,
                'ministry_ids' => $enrollments->get($student->id)->pluck('ministry_id')->sort()->values()->all(),
                'next_birthday_month_day' => $birthMonthDay,
                'turning_age' => $student->date_of_birth ? $birthdayYear - $student->date_of_birth->year : null,
            ];
        })->values();

        $lease = $issue->handle($membership, $deviceId);
        $serverCursor = (int) (ChangeFeedEntry::query()->where('church_id', $churchId)->max('sequence') ?? 0);
        DB::table('device_cursors')->upsert([[
            'id' => (string) Str::uuid(),
            'church_id' => $churchId,
            'membership_id' => $membership->id,
            'device_id' => $deviceId,
            'cursor' => $serverCursor,
            'full_resync_required' => false,
            'updated_at' => now('UTC'),
        ]], ['membership_id', 'device_id'], ['cursor', 'full_resync_required', 'updated_at']);

        return response()->json([
            'actor' => ['id' => (string) $membership->user_id],
            'timezone' => $timezone,
            'ministries' => $ministries,
            'roster' => $roster,
            'lease' => $lease,
            'server_cursor' => (string) $serverCursor,
        ])->header('Cache-Control', 'no-store, private');
    }
}
