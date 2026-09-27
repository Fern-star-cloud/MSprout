<?php

namespace App\Http\Controllers;

use App\Actions\Students\NormalizeStudentInput;
use App\Domain\Audit\AuditEntry;
use App\Domain\Audit\AuditWriter;
use App\Enums\ChurchRole;
use App\Models\ChurchMembership;
use App\Models\Enrollment;
use App\Models\Ministry;
use App\Models\Student;
use App\Policies\ChurchMembershipPolicy;
use App\Policies\StudentPolicy;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

final class RosterController extends Controller
{
    private function church(): string
    {
        return app(TenantContext::class)->churchId();
    }

    private function owner(Request $request): void
    {
        abort_unless((new ChurchMembershipPolicy)->manage($request->user()), 403);
    }

    private function rejectUnexpected(Request $request, array $keys): void
    {
        abort_if(array_diff(array_keys($request->all()), $keys) !== [] || $request->allFiles() !== [], 422);
    }

    private function audit(Request $request, string $action, string $type, string $id): void
    {
        app(AuditWriter::class)->record(new AuditEntry('church', $action, 'user', (string) $request->user()->id, $type, $id, 'success', $this->church()));
    }

    public function ministries(Request $request)
    {
        $church = $this->church();
        $query = Ministry::where('church_id', $church);
        $owner = app(TenantContext::class)->role() === ChurchRole::Owner;
        if (! $owner || $request->query('include_archived') !== 'true') {
            $query->whereNull('deleted_at')->whereNull('archived_at');
        }
        if (! $owner) {
            $membership = ChurchMembership::where('church_id', $church)->where('user_id', $request->user()->id)->where('status', 'active')->firstOrFail();
            $query->whereIn('id', DB::table('teacher_ministry_assignments')->select('ministry_id')->where('church_id', $church)->where('membership_id', $membership->id)->whereNull('revoked_at'));
        }

        return response()->json(['data' => $query->orderBy('name')->orderBy('id')->get()->map(fn ($m) => ['id' => $m->id, 'name' => $m->name, 'status' => $m->deleted_at || $m->archived_at ? 'archived' : 'active', 'version' => $m->version])]);
    }

    public function createMinistry(Request $request)
    {
        $this->owner($request);
        $this->rejectUnexpected($request, ['name']);
        $data = $request->validate(['name' => ['required', 'string', 'max:120']]);
        $name = trim(preg_replace('/[\s\p{Z}]+/u', ' ', $data['name']));
        abort_if($name === '', 422);
        $ministry = DB::transaction(function () use ($request, $name) {
            $row = Ministry::create(['church_id' => $this->church(), 'name' => $name, 'version' => 1]);
            $this->audit($request, 'ministry.created', 'ministry', $row->id);

            return $row;
        });

        return response()->json(['id' => $ministry->id, 'name' => $ministry->name, 'status' => 'active', 'version' => $ministry->version], 201);
    }

    public function updateMinistry(Request $request, string $id)
    {
        $this->owner($request);
        $this->rejectUnexpected($request, ['name']);
        $name = trim(preg_replace('/[\s\p{Z}]+/u', ' ', $request->validate(['name' => ['required', 'string', 'max:120']])['name']));
        abort_if($name === '', 422);
        $row = DB::transaction(function () use ($request, $id, $name) {
            $m = Ministry::where('church_id', $this->church())->lockForUpdate()->findOrFail($id);
            $m->forceFill(['name' => $name, 'version' => $m->version + 1])->save();
            $this->audit($request, 'ministry.updated', 'ministry', $m->id);

            return $m;
        });

        return response()->json(['id' => $row->id, 'name' => $row->name, 'status' => $row->deleted_at || $row->archived_at ? 'archived' : 'active', 'version' => $row->version]);
    }

    public function ministryStatus(Request $request, string $id, string $status)
    {
        $this->owner($request);
        $this->rejectUnexpected($request, []);
        abort_unless(in_array($status, ['archive', 'restore'], true), 404);
        $row = DB::transaction(function () use ($request, $id, $status) {
            $m = Ministry::where('church_id', $this->church())->lockForUpdate()->findOrFail($id);
            $m->forceFill(['deleted_at' => $status === 'archive' ? now() : null, 'archived_at' => $status === 'archive' ? now() : null, 'version' => $m->version + 1])->save();
            $this->audit($request, 'ministry.'.$status.'d', 'ministry', $m->id);

            return $m;
        });

        return response()->json(['id' => $row->id, 'name' => $row->name, 'status' => $status === 'archive' ? 'archived' : 'active', 'version' => $row->version]);
    }

    public function students(Request $request)
    {
        $church = $this->church();
        $owner = app(TenantContext::class)->role() === ChurchRole::Owner;
        $query = Student::where('church_id', $church);
        if (! $owner || $request->query('include_archived') !== 'true') {
            $query->whereNull('deleted_at');
        }
        if ($request->filled('ministry_id')) {
            abort_unless(Str::isUuid($request->query('ministry_id')), 422);
            $query->whereIn('id', Enrollment::where('church_id', $church)->where('ministry_id', $request->query('ministry_id'))->whereNull('deleted_at')->select('student_id'));
        }
        if (! $owner) {
            $membership = ChurchMembership::where('church_id', $church)->where('user_id', $request->user()->id)->where('status', 'active')->firstOrFail();
            $assigned = DB::table('teacher_ministry_assignments')->select('ministry_id')->where('church_id', $church)->where('membership_id', $membership->id)->whereNull('revoked_at');
            $activeAssigned = Ministry::where('church_id', $church)->whereNull('deleted_at')->whereNull('archived_at')->whereIn('id', $assigned)->select('id');
            $query->whereIn('id', Enrollment::where('church_id', $church)->whereNull('deleted_at')->whereIn('ministry_id', $activeAssigned)->select('student_id'));
            $visibleMinistryIds = (clone $activeAssigned)->pluck('id')->all();
        } else {
            $visibleMinistryIds = null;
        }

        return response()->json(['data' => $query->orderBy('last_name')->orderBy('first_name')->orderBy('id')->get()->map(fn ($s) => $s->projection($owner, $visibleMinistryIds))]);
    }

    public function showStudent(Request $request, string $id)
    {
        $owner = app(TenantContext::class)->role() === ChurchRole::Owner;
        $query = Student::where('church_id', $this->church());
        if (! $owner) {
            $query->whereNull('deleted_at');
        }
        $student = $query->findOrFail($id);
        abort_unless((new StudentPolicy)->view($request->user(), $student), 404);

        $visibleMinistryIds = null;
        if (! $owner) {
            $membership = ChurchMembership::where('church_id', $this->church())->where('user_id', $request->user()->id)->where('status', 'active')->firstOrFail();
            $visibleMinistryIds = DB::table('teacher_ministry_assignments')->join('ministries', function ($join) {
                $join->on('ministries.church_id', '=', 'teacher_ministry_assignments.church_id')->on('ministries.id', '=', 'teacher_ministry_assignments.ministry_id');
            })->where('teacher_ministry_assignments.church_id', $this->church())->where('teacher_ministry_assignments.membership_id', $membership->id)
                ->whereNull('teacher_ministry_assignments.revoked_at')->whereNull('ministries.deleted_at')->whereNull('ministries.archived_at')->pluck('ministries.id')->all();
        }

        return response()->json($student->projection($owner, $visibleMinistryIds));
    }

    public function createStudent(Request $request)
    {
        $this->owner($request);
        $fields = ['first_name', 'middle_name', 'last_name', 'preferred_name', 'suffix', 'date_of_birth', 'gender', 'external_reference', 'ministry_ids'];
        $this->rejectUnexpected($request, $fields);
        $input = $request->validate(['first_name' => ['required', 'string', 'max:120'], 'middle_name' => ['nullable', 'string', 'max:120'], 'last_name' => ['required', 'string', 'max:120'], 'preferred_name' => ['nullable', 'string', 'max:120'], 'suffix' => ['nullable', 'string', 'max:40'], 'date_of_birth' => ['nullable', 'string'], 'gender' => ['nullable', 'string', 'max:32'], 'external_reference' => ['nullable', 'string', 'max:120'], 'ministry_ids' => ['sometimes', 'array', 'max:100'], 'ministry_ids.*' => ['required', 'uuid', 'distinct']]);
        try {
            $normalized = NormalizeStudentInput::handle($input);
        } catch (InvalidArgumentException $e) {
            abort(422, 'Student details are invalid.');
        }
        try {
            $student = DB::transaction(function () use ($request, $normalized, $input) {
                $church = $this->church();
                $this->validateMinistries($input['ministry_ids'] ?? [], $church);
                $this->assertExternalReferenceAvailable($church, $normalized->externalReference);
                $row = Student::create(['church_id' => $church, 'version' => 1] + $normalized->toArray());
                $this->syncEnrollments($church, $row->id, $input['ministry_ids'] ?? []);
                $this->audit($request, 'student.created', 'student', $row->id);

                return $row;
            });
        } catch (QueryException $e) {
            $this->handleExternalReferenceConflict($e);
            throw $e;
        }

        return response()->json($student->projection(true), 201);
    }

    public function updateStudent(Request $request, string $id)
    {
        $this->owner($request);
        $fields = ['first_name', 'middle_name', 'last_name', 'preferred_name', 'suffix', 'date_of_birth', 'gender', 'external_reference', 'ministry_ids'];
        $this->rejectUnexpected($request, $fields);
        $input = $request->validate(['first_name' => ['required', 'string', 'max:120'], 'middle_name' => ['nullable', 'string', 'max:120'], 'last_name' => ['required', 'string', 'max:120'], 'preferred_name' => ['nullable', 'string', 'max:120'], 'suffix' => ['nullable', 'string', 'max:40'], 'date_of_birth' => ['nullable', 'string'], 'gender' => ['nullable', 'string', 'max:32'], 'external_reference' => ['nullable', 'string', 'max:120'], 'ministry_ids' => ['sometimes', 'array', 'max:100'], 'ministry_ids.*' => ['required', 'uuid', 'distinct']]);
        try {
            $normalized = NormalizeStudentInput::handle($input);
        } catch (InvalidArgumentException $e) {
            abort(422, 'Student details are invalid.');
        }
        try {
            $student = DB::transaction(function () use ($request, $id, $normalized, $input) {
                $church = $this->church();
                $row = Student::where('church_id', $church)->lockForUpdate()->findOrFail($id);
                if (array_key_exists('ministry_ids', $input)) {
                    $this->validateMinistries($input['ministry_ids'], $church);
                }
                $this->assertExternalReferenceAvailable($church, $normalized->externalReference, $row->id);
                $row->forceFill($normalized->toArray() + ['version' => $row->version + 1])->save();
                if (array_key_exists('ministry_ids', $input)) {
                    $this->syncEnrollments($church, $row->id, $input['ministry_ids']);
                }
                $this->audit($request, 'student.updated', 'student', $row->id);

                return $row;
            });
        } catch (QueryException $e) {
            $this->handleExternalReferenceConflict($e);
            throw $e;
        }

        return response()->json($student->projection(true));
    }

    public function studentStatus(Request $request, string $id, string $status)
    {
        $this->owner($request);
        $this->rejectUnexpected($request, []);
        abort_unless(in_array($status, ['archive', 'restore'], true), 404);
        $row = DB::transaction(function () use ($request, $id, $status) {
            $student = Student::where('church_id', $this->church())->lockForUpdate()->findOrFail($id);
            $student->forceFill(['deleted_at' => $status === 'archive' ? now() : null, 'version' => $student->version + 1])->save();
            $this->audit($request, 'student.'.$status.'d', 'student', $student->id);

            return $student;
        });

        return response()->json($row->projection(true));
    }

    public function enroll(Request $request, string $id)
    {
        $this->owner($request);
        $this->rejectUnexpected($request, ['ministry_ids']);
        $input = $request->validate(['ministry_ids' => ['required', 'array', 'max:100'], 'ministry_ids.*' => ['required', 'uuid', 'distinct']]);
        DB::transaction(function () use ($request, $id, $input) {
            $church = $this->church();
            $student = Student::where('church_id', $church)->lockForUpdate()->findOrFail($id);
            $this->validateMinistries($input['ministry_ids'], $church);
            $this->syncEnrollments($church, $student->id, $input['ministry_ids']);
            $student->increment('version');
            $this->audit($request, 'student.enrollment.updated', 'student', $student->id);
        });

        return response()->json(Student::where('church_id', $this->church())->findOrFail($id)->projection(true));
    }

    private function validateMinistries(array $ids, string $church): void
    {
        if (count($ids) !== Ministry::where('church_id', $church)->whereNull('deleted_at')->whereNull('archived_at')->whereIn('id', $ids)->count()) {
            abort(422, 'One or more ministries are unavailable.');
        }
    }

    private function assertExternalReferenceAvailable(string $church, ?string $reference, ?string $ignoreStudentId = null): void
    {
        if ($reference === null) {
            return;
        }
        $query = Student::where('church_id', $church)->whereRaw('lower(external_reference) = ?', [mb_strtolower($reference)]);
        if ($ignoreStudentId !== null) {
            $query->where('id', '<>', $ignoreStudentId);
        }
        abort_if($query->exists(), 422, 'External reference is already in use.');
    }

    private function handleExternalReferenceConflict(QueryException $exception): void
    {
        if ($exception->getCode() === '23505' && str_contains($exception->getMessage(), 'students_external_reference_unique')) {
            abort(422, 'External reference is already in use.');
        }
    }

    private function syncEnrollments(string $church, string $studentId, array $ids): void
    {
        Enrollment::where('church_id', $church)->where('student_id', $studentId)->get()->each(function ($e) use ($ids) {
            $restore = in_array($e->ministry_id, $ids, true) ? null : now();
            if ($e->deleted_at != $restore) {
                $e->forceFill(['deleted_at' => $restore, 'version' => $e->version + 1])->save();
            }
        });
        foreach (array_diff($ids, Enrollment::where('church_id', $church)->where('student_id', $studentId)->whereIn('ministry_id', $ids)->pluck('ministry_id')->all()) as $ministryId) {
            Enrollment::create(['church_id' => $church, 'student_id' => $studentId, 'ministry_id' => $ministryId, 'version' => 1]);
        }
    }
}
