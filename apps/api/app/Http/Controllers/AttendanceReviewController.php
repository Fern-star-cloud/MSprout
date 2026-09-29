<?php

namespace App\Http\Controllers;

use App\Actions\Attendance\CorrectAttendance;
use App\Actions\Attendance\ResolveConflict;
use App\Actions\Guests\ResolveAttendanceGuest;
use App\Enums\ChurchRole;
use App\Models\AttendanceGuest;
use App\Models\ChurchMembership;
use App\Models\SyncConflict;
use App\Support\Tenancy\TenantContext;
use DomainException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;

final class AttendanceReviewController extends Controller
{
    public function conflicts(): JsonResponse
    {
        if (app(TenantContext::class)->role() !== ChurchRole::Owner) {
            $actor = request()->user();
            $membershipId = ChurchMembership::query()->where('church_id', app(TenantContext::class)->churchId())
                ->where('user_id', $actor->id)->where('status', 'active')->value('id');
            $needsReview = SyncConflict::query()
                ->join('attendance_sessions', function ($join): void {
                    $join->on('attendance_sessions.church_id', '=', 'sync_conflicts.church_id')
                        ->on('attendance_sessions.id', '=', 'sync_conflicts.attendance_session_id');
                })
                ->join('teacher_ministry_assignments', function ($join) use ($membershipId): void {
                    $join->on('teacher_ministry_assignments.church_id', '=', 'attendance_sessions.church_id')
                        ->on('teacher_ministry_assignments.ministry_id', '=', 'attendance_sessions.ministry_id')
                        ->where('teacher_ministry_assignments.membership_id', $membershipId)
                        ->whereNull('teacher_ministry_assignments.revoked_at');
                })
                ->where('sync_conflicts.status', 'open')->exists();

            return response()->json(['needs_owner_review' => $needsReview]);
        }

        return response()->json(['data' => SyncConflict::query()
            ->where('status', 'open')->orderBy('created_at')->orderBy('id')->limit(100)->get()
            ->map(fn (SyncConflict $conflict): array => $this->conflictProjection($conflict))->values()]);
    }

    public function conflict(string $id): JsonResponse
    {
        $this->owner();

        return response()->json($this->conflictProjection(SyncConflict::query()->findOrFail($id)));
    }

    public function resolve(Request $request, string $id, ResolveConflict $resolve): JsonResponse
    {
        $this->owner();
        $this->only($request, ['choice', 'reason']);
        $input = $request->validate([
            'choice' => ['required', 'in:existing,incoming'],
            'reason' => ['required', 'string', 'max:500'],
        ]);

        return $this->domain(fn (): array => $resolve->handle($id, $input['choice'], $input['reason'], $request->user()));
    }

    public function correct(Request $request, string $session, string $record, CorrectAttendance $correct): JsonResponse
    {
        $this->owner();
        $this->only($request, ['state', 'reason']);
        $input = $request->validate([
            'state' => ['required', 'in:present,absent'],
            'reason' => ['required', 'string', 'max:500'],
        ]);

        return $this->domain(fn (): array => $correct->handle($session, $record, $input['state'], $input['reason'], $request->user()));
    }

    public function guest(Request $request, string $id, string $resolution, ResolveAttendanceGuest $resolve): JsonResponse
    {
        $this->owner();
        $allowed = match ($resolution) {
            'promote' => ['first_name', 'middle_name', 'last_name', 'preferred_name', 'suffix', 'date_of_birth', 'gender', 'external_reference'],
            'link' => ['student_id'],
            'merge' => ['guest_id'],
            default => abort(404),
        };
        $this->only($request, $allowed);
        $rules = match ($resolution) {
            'promote' => [
                'first_name' => ['required', 'string', 'max:120'], 'middle_name' => ['nullable', 'string', 'max:120'],
                'last_name' => ['required', 'string', 'max:120'], 'preferred_name' => ['nullable', 'string', 'max:120'],
                'suffix' => ['nullable', 'string', 'max:40'], 'date_of_birth' => ['nullable', 'string'],
                'gender' => ['nullable', 'in:male,female,unspecified'], 'external_reference' => ['nullable', 'string', 'max:120'],
            ],
            'link' => ['student_id' => ['required', 'uuid']],
            'merge' => ['guest_id' => ['required', 'uuid', 'different:id']],
        };
        $input = $request->validate($rules);

        return $this->domain(fn (): array => $resolve->handle($id, $resolution, $input, $request->user()));
    }

    public function guests(): JsonResponse
    {
        $this->owner();

        return response()->json(['data' => AttendanceGuest::query()
            ->where('status', 'pending')->orderBy('occurred_at')->orderBy('id')->limit(100)->get()
            ->map(fn (AttendanceGuest $guest): array => [
                'id' => $guest->id, 'session_id' => $guest->attendance_session_id,
                'display_name' => $guest->display_name, 'gender' => $guest->gender,
                'actor_id' => $guest->created_by, 'device_id' => $guest->source_device_id,
                'local_time' => $guest->occurred_at->toISOString(),
                'server_time' => $guest->received_at->toISOString(),
            ])->values()]);
    }

    private function conflictProjection(SyncConflict $conflict): array
    {
        return [
            'id' => $conflict->id, 'session_id' => $conflict->attendance_session_id,
            'record_id' => $conflict->attendance_record_id, 'field' => $conflict->field,
            'base_version' => $conflict->base_version, 'status' => $conflict->status,
            'existing' => [
                'value' => $conflict->existing_value, 'actor_id' => $conflict->existing_actor_id,
                'device_id' => $conflict->existing_device_id,
                'local_time' => $conflict->existing_occurred_at?->toISOString(),
                'server_time' => $conflict->existing_received_at?->toISOString(),
                'correlation_id' => $conflict->existing_correlation_id,
            ],
            'incoming' => [
                'value' => $conflict->incoming_value, 'actor_id' => $conflict->incoming_actor_id,
                'device_id' => $conflict->incoming_device_id,
                'local_time' => $conflict->incoming_occurred_at->toISOString(),
                'server_time' => $conflict->incoming_received_at->toISOString(),
                'correlation_id' => $conflict->incoming_correlation_id,
            ],
        ];
    }

    private function owner(): void
    {
        abort_unless(app(TenantContext::class)->role() === ChurchRole::Owner, 403);
    }

    private function only(Request $request, array $allowed): void
    {
        abort_if(array_diff(array_keys($request->all()), $allowed) !== [] || $request->allFiles() !== [], 422);
    }

    private function domain(callable $action): JsonResponse
    {
        try {
            return response()->json($action());
        } catch (DomainException|InvalidArgumentException $exception) {
            abort(422, $exception->getMessage());
        }
    }
}
