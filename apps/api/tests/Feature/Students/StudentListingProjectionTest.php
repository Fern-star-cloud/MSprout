<?php

use App\Models\Enrollment;
use App\Models\Student;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\ChurchScenario;
use Tests\Support\MembershipScenario;
use Tests\Support\PersistedChurchSession;
use Tests\Support\PostgresTestDatabase;

beforeEach(function () {
    PostgresTestDatabase::refresh();
    [$this->owner, $this->church, $this->membership] = MembershipScenario::owner($this);
});

function listingStudents(string $church, int $count, array $ministries = []): array
{
    $students = $enrollments = $ids = [];
    for ($i = 0; $i < $count; $i++) {
        $id = $ids[] = (string) Str::uuid();
        $students[] = ['id' => $id, 'church_id' => $church, 'first_name' => 'Synthetic',
            'middle_name' => 'Test', 'last_name' => sprintf('Student %04d', $count - $i),
            'preferred_name' => $i === 0 ? 'Synthetic preferred' : null, 'suffix' => 'Jr',
            'date_of_birth' => $i === 1 ? null : '2018-08-20', 'gender' => 'unspecified',
            'external_reference' => 'synthetic-'.$id, 'version' => 1, 'created_at' => now(), 'updated_at' => now()];
        foreach ($ministries as $ministry) {
            $enrollments[] = ['id' => (string) Str::uuid(), 'church_id' => $church,
                'student_id' => $id, 'ministry_id' => $ministry, 'version' => 1, 'created_at' => now(), 'updated_at' => now()];
        }
    }
    $db = DB::connection('pgsql_migration');
    foreach (array_chunk($students, 200) as $rows) {
        $db->table('students')->insert($rows);
    }
    foreach (array_chunk($enrollments, 200) as $rows) {
        $db->table('enrollments')->insert($rows);
    }

    return $ids;
}

function listingLegacy(string $church, bool $owner, ?array $visible = null, ?array $ids = null): array
{
    return app(TenantContext::class)->run($church, function () use ($church, $owner, $visible, $ids) {
        $query = Student::where('church_id', $church);
        if ($ids !== null) {
            $query->whereIn('id', $ids);
        }

        // No supplied batch: exercises the unchanged per-student projection as a response oracle.
        return $query->orderBy('last_name')->orderBy('first_name')->orderBy('id')->get()
            ->map(fn ($student) => $student->projection($owner, $visible))->all();
    });
}

function listingTeacher($test, array $ministries, string $status = 'active'): void
{
    [$teacher, $membership] = ChurchScenario::teacher($test->church, $status);
    foreach ($ministries as $ministry) {
        DB::connection('pgsql_migration')->table('teacher_ministry_assignments')->insert([
            'id' => (string) Str::uuid(), 'church_id' => $test->church->id,
            'membership_id' => $membership->id, 'ministry_id' => $ministry,
            'assigned_by' => $test->owner->id, 'created_at' => now(), 'updated_at' => now(),
        ]);
    }
    $teacher = User::findOrFail($teacher->id);
    PersistedChurchSession::authenticate($test, $teacher, 'web')->withPersistedSession(['password_hash_web' => $teacher->getAuthPassword()]);
}

it('bounds enrollment query growth and preserves the complete legacy response for :dataset', function (bool $owner, int $size) {
    $first = MembershipScenario::ministry($this->church->id);
    $second = MembershipScenario::ministry($this->church->id);
    listingStudents($this->church->id, $size, [$second, $first]);
    if (! $owner) {
        listingTeacher($this, [$first]);
    }
    $expected = listingLegacy($this->church->id, $owner, $owner ? null : [$first]);
    $connection = DB::connection();
    $connection->enableQueryLog();
    $connection->flushQueryLog();
    try {
        $response = $this->getJson('/api/students')->assertOk()->assertExactJson(['data' => $expected]);
        $queries = $connection->getQueryLog();
    } finally {
        $connection->disableQueryLog();
        $connection->flushQueryLog();
    }
    $enrollmentReads = array_filter($queries, function ($query) {
        return preg_match('/^select\b.*?\bfrom\s+"([^"]+)"/i', $query['query'], $match)
            && $match[1] === 'enrollments';
    });
    fwrite(STDOUT, json_encode(['UX02B' => $owner ? 'owner' : 'teacher', 'students' => $size,
        'runtime_queries' => count($queries), 'enrollment_reads' => count($enrollmentReads)]).PHP_EOL);
    expect($response->json('data'))->toHaveCount($size)
        ->and(count($enrollmentReads))->toBeLessThanOrEqual((int) ceil($size / 500));
    $keys = ['id', 'first_name', 'middle_name', 'last_name', 'preferred_name', 'suffix', 'display_name', 'gender', 'status', 'version', 'ministry_ids'];
    $keys = array_merge($keys, $owner ? ['date_of_birth', 'age', 'external_reference'] : ['birth_month_day', 'age']);
    foreach ($response->json('data') as $row) {
        expect(array_keys($row))->toBe($keys);
    }
})->with(['owner empty' => [true, 0], 'owner small' => [true, 5], 'owner 200' => [true, 200], 'owner batch boundary' => [true, 501],
    'teacher empty' => [false, 0], 'teacher small' => [false, 5], 'teacher 200' => [false, 200], 'teacher batch boundary' => [false, 501]]);

it('preserves Owner ordering, empty enrollments, archives and ministry filters', function () {
    $active = MembershipScenario::ministry($this->church->id);
    $archived = MembershipScenario::ministry($this->church->id);
    $deleted = MembershipScenario::ministry($this->church->id);
    $db = DB::connection('pgsql_migration');
    $db->table('ministries')->where('id', $archived)->update(['archived_at' => now()]);
    $ids = listingStudents($this->church->id, 3, [$archived, $active, $deleted]);
    $db->table('enrollments')->where('ministry_id', $deleted)->update(['deleted_at' => now()]);
    $empty = listingStudents($this->church->id, 1)[0];
    $db->table('students')->where('id', $empty)->update(['last_name' => 'Student 0000']);
    $db->table('students')->where('id', $ids[1])->update(['deleted_at' => now()]);
    $expected = listingLegacy($this->church->id, true);
    $activeRows = array_values(array_filter($expected, fn ($row) => $row['status'] === 'active'));
    $this->getJson('/api/students')->assertOk()->assertExactJson(['data' => $activeRows]);
    expect($activeRows[0]['id'])->toBe($empty)->and($activeRows[0]['ministry_ids'])->toBe([]);
    $this->getJson('/api/students?include_archived=true')->assertOk()->assertExactJson(['data' => $expected]);
    $filtered = array_values(array_filter($activeRows, fn ($row) => in_array($active, $row['ministry_ids'], true)));
    $this->getJson('/api/students?ministry_id='.$active)->assertOk()->assertExactJson(['data' => $filtered]);
    $this->getJson('/api/students?ministry_id='.$deleted)->assertOk()->assertExactJson(['data' => []]);
    $this->getJson('/api/students?ministry_id=invalid')->assertUnprocessable();
    $db->table('enrollments')->where('church_id', $this->church->id)->update(['deleted_at' => now()]);
    $this->getJson('/api/students')->assertOk()->assertJsonPath('data.0.ministry_ids', []);
});

it('preserves Teacher assignment intersections, privacy and existing shared-student filter semantics', function () {
    $assigned = MembershipScenario::ministry($this->church->id);
    $unassigned = MembershipScenario::ministry($this->church->id);
    $archived = MembershipScenario::ministry($this->church->id);
    $revoked = MembershipScenario::ministry($this->church->id);
    $deleted = MembershipScenario::ministry($this->church->id);
    $db = DB::connection('pgsql_migration');
    $db->table('ministries')->where('id', $archived)->update(['archived_at' => now()]);
    $db->table('ministries')->where('id', $deleted)->update(['deleted_at' => now()]);
    $visible = listingStudents($this->church->id, 2, [$unassigned, $assigned, $archived, $revoked, $deleted]);
    $archivedStudent = listingStudents($this->church->id, 1, [$assigned])[0];
    $db->table('students')->where('id', $archivedStudent)->update(['deleted_at' => now()]);
    listingStudents($this->church->id, 2, [$unassigned]);
    listingStudents($this->church->id, 1);
    listingTeacher($this, [$assigned, $archived, $revoked, $deleted]);
    $db->table('teacher_ministry_assignments')->where('ministry_id', $revoked)->update(['revoked_at' => now()]);
    $expected = listingLegacy($this->church->id, false, [$assigned], $visible);
    $response = $this->getJson('/api/students?include_archived=true')->assertOk()->assertExactJson(['data' => $expected]);
    foreach ($response->json('data') as $row) {
        expect($row['ministry_ids'])->toBe([$assigned])->and($row)->not->toHaveKeys(['date_of_birth', 'external_reference']);
    }
    expect(array_column($expected, 'birth_month_day'))->toContain('08-20', null);
    $this->getJson('/api/students?ministry_id='.$unassigned)->assertOk()->assertExactJson(['data' => $expected]);
    $db->table('enrollments')->where('ministry_id', $assigned)->update(['deleted_at' => now()]);
    $this->getJson('/api/students')->assertOk()->assertExactJson(['data' => []]);
});

it('does not expose unassigned or inactive Teacher rosters', function () {
    $ministry = MembershipScenario::ministry($this->church->id);
    listingStudents($this->church->id, 2, [$ministry]);
    listingTeacher($this, []);
    $this->getJson('/api/students')->assertOk()->assertExactJson(['data' => []]);
    listingTeacher($this, [$ministry], 'inactive');
    $this->getJson('/api/students')->assertForbidden();
});

it('keeps foreign student and enrollment records outside both roles and enforces restricted forced RLS', function () {
    $local = MembershipScenario::ministry($this->church->id);
    listingStudents($this->church->id, 2, [$local]);
    [, $foreignChurch] = ChurchScenario::owner();
    $foreign = MembershipScenario::ministry($foreignChurch->id);
    $foreignIds = listingStudents($foreignChurch->id, 2, [$foreign]);
    $expected = listingLegacy($this->church->id, true);
    $this->getJson('/api/students')->assertOk()->assertExactJson(['data' => $expected]);
    $this->getJson('/api/students?ministry_id='.$foreign)->assertOk()->assertExactJson(['data' => []]);
    $this->getJson('/api/students/'.$foreignIds[0])->assertNotFound();
    $this->withHeader('X-Church-Id', $foreignChurch->id)->getJson('/api/students')->assertForbidden();
    $this->withHeader('X-Church-Id', $this->church->id);
    listingTeacher($this, [$local]);
    $teacherRows = listingLegacy($this->church->id, false, [$local]);
    $this->getJson('/api/students')->assertOk()->assertExactJson(['data' => $teacherRows]);
    app(TenantContext::class)->run($this->church->id, function () use ($foreignIds) {
        expect(Student::whereIn('id', $foreignIds)->count())->toBe(0)
            ->and(Enrollment::whereIn('student_id', $foreignIds)->count())->toBe(0);
        $role = DB::selectOne('SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user');
        expect((bool) $role->rolsuper)->toBeFalse()->and((bool) $role->rolbypassrls)->toBeFalse();
        $tables = DB::select("SELECT relrowsecurity, relforcerowsecurity, pg_get_userbyid(relowner) = current_user AS owned FROM pg_class WHERE relname IN ('students', 'enrollments') AND relnamespace = current_schema()::regnamespace");
        expect($tables)->toHaveCount(2);
        foreach ($tables as $table) {
            expect((bool) $table->relrowsecurity)->toBeTrue()->and((bool) $table->relforcerowsecurity)->toBeTrue()->and((bool) $table->owned)->toBeFalse();
        }
    });
});
