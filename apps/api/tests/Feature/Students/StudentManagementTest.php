<?php

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\ChurchScenario;
use Tests\Support\MembershipScenario;
use Tests\Support\PostgresTestDatabase;

beforeEach(function () {
    PostgresTestDatabase::refresh();
    [$this->owner, $this->church, $this->membership] = MembershipScenario::owner($this);
});

it('lets an Owner manage ministries, normalized students, enrollments, and lifecycle with audit evidence', function () {
    $ministry = $this->postJson('/api/ministries', ['name' => '  Primary   Kids '])->assertCreated()->assertJsonPath('name', 'Primary Kids')->json('id');
    $id = $this->postJson('/api/students', [
        'first_name' => '  McKayla ', 'last_name' => ' de   la Cruz ', 'gender' => '',
        'date_of_birth' => '2018-08-20', 'ministry_ids' => [$ministry],
    ])->assertCreated()->assertJsonPath('display_name', 'McKayla de la Cruz')->assertJsonPath('gender', 'unspecified')->json('id');
    $this->getJson('/api/students')->assertJsonPath('data.0.date_of_birth', '2018-08-20')->assertJsonStructure(['data' => [['age']]]);
    $this->postJson("/api/students/{$id}/archive")->assertOk()->assertJsonPath('status', 'archived');
    $this->getJson('/api/students')->assertJsonCount(0, 'data');
    $this->getJson('/api/students?include_archived=true')->assertJsonCount(1, 'data')->assertJsonPath('data.0.status', 'archived');
    $this->postJson("/api/students/{$id}/restore")->assertOk()->assertJsonPath('status', 'active');
    $audit = DB::connection('pgsql_migration')->table('audit_events');
    expect(DB::connection('pgsql_migration')->table('audit_events')->where('church_id', $this->church->id)->count())->toBe(4)
        ->and(DB::connection('pgsql_migration')->table('audit_events')->where('target_id', $id)->pluck('action')->all())->toContain('student.restored')
        ->and(json_encode(DB::connection('pgsql_migration')->table('audit_events')->where('target_id', $id)->pluck('metadata_json')))->not->toContain('McKayla');
});

it('lets an Owner edit ministries and replace a student enrollment', function () {
    $ministry = $this->postJson('/api/ministries', ['name' => 'Primary'])->assertCreated()->json('id');
    $secondMinistry = $this->postJson('/api/ministries', ['name' => 'Youth'])->assertCreated()->json('id');
    $this->putJson('/api/ministries/'.$ministry, ['name' => 'Primary group'])->assertOk()->assertJsonPath('name', 'Primary group');
    $student = $this->postJson('/api/students', ['first_name' => 'Ari', 'last_name' => 'Sprout', 'ministry_ids' => [$ministry]])->assertCreated()->json('id');
    $this->putJson('/api/students/'.$student, [
        'first_name' => 'Ari', 'last_name' => 'Sprout', 'preferred_name' => 'Ari S.',
        'gender' => 'female', 'ministry_ids' => [$secondMinistry],
    ])->assertOk()->assertJsonPath('display_name', 'Ari S.')->assertJsonPath('version', 2)->assertJsonPath('ministry_ids.0', $secondMinistry);
});

it('lets an Owner update student details while preserving an enrollment in an archived ministry', function () {
    $ministry = $this->postJson('/api/ministries', ['name' => 'Primary'])->assertCreated()->json('id');
    $student = $this->postJson('/api/students', [
        'first_name' => 'Ari', 'last_name' => 'Sprout', 'ministry_ids' => [$ministry],
    ])->assertCreated()->json('id');

    $this->postJson('/api/ministries/'.$ministry.'/archive')->assertOk()->assertJsonPath('status', 'archived');
    $this->putJson('/api/students/'.$student, [
        'first_name' => 'Ari', 'last_name' => 'Sprout', 'preferred_name' => 'Ari S.',
    ])->assertOk()->assertJsonPath('display_name', 'Ari S.')->assertJsonPath('ministry_ids.0', $ministry);

    expect(DB::connection('pgsql_migration')->table('enrollments')
        ->where('church_id', $this->church->id)->where('student_id', $student)
        ->where('ministry_id', $ministry)->whereNull('deleted_at')->count())->toBe(1);
});

it('lets an Owner archive and restore only ministries in the active church', function () {
    $ministry = $this->postJson('/api/ministries', ['name' => 'Primary'])->assertCreated()->json('id');
    [, $foreignChurch] = ChurchScenario::owner();
    $foreignMinistry = MembershipScenario::ministry($foreignChurch->id);

    $this->postJson('/api/ministries/'.$foreignMinistry.'/archive')->assertNotFound();
    $this->postJson('/api/ministries/'.$ministry.'/archive')->assertOk()->assertJsonPath('status', 'archived');
    $this->getJson('/api/ministries')->assertOk()->assertJsonCount(0, 'data');
    $this->getJson('/api/ministries?include_archived=true')->assertOk()
        ->assertJsonPath('data.0.id', $ministry)->assertJsonPath('data.0.status', 'archived');

    $this->postJson('/api/ministries/'.$ministry.'/restore')->assertOk()->assertJsonPath('status', 'active');
    $this->getJson('/api/ministries')->assertOk()
        ->assertJsonPath('data.0.id', $ministry)->assertJsonPath('data.0.status', 'active');
    expect(DB::connection('pgsql_migration')->table('ministries')->where('id', $foreignMinistry)->value('archived_at'))->toBeNull();
});

it('rejects future births and foreign ministries without partially creating a student', function () {
    [, $foreignChurch] = ChurchScenario::owner();
    $foreignMinistry = MembershipScenario::ministry($foreignChurch->id);
    $this->postJson('/api/students', ['first_name' => 'Ari', 'last_name' => 'Sprout', 'date_of_birth' => '2099-01-01'])->assertUnprocessable();
    $this->postJson('/api/students', ['first_name' => 'Ari', 'last_name' => 'Sprout', 'ministry_ids' => [$foreignMinistry]])->assertUnprocessable();
    $foreignStudent = (string) Str::uuid();
    DB::connection('pgsql_migration')->table('students')->insert(['id' => $foreignStudent, 'church_id' => $foreignChurch->id, 'first_name' => 'Ari', 'last_name' => 'Sprout', 'gender' => 'unspecified', 'version' => 1, 'created_at' => now(), 'updated_at' => now()]);
    $this->getJson('/api/students/'.$foreignStudent)->assertNotFound();
    expect(DB::connection('pgsql_migration')->table('students')->where('church_id', $this->church->id)->count())->toBe(0);
});

it('enforces case-insensitive per-church external reference uniqueness', function () {
    $this->postJson('/api/students', ['first_name' => 'Ari', 'last_name' => 'Sprout', 'external_reference' => 'Member-7'])->assertCreated();
    $this->postJson('/api/students', ['first_name' => 'Kai', 'last_name' => 'Sprout', 'external_reference' => 'member-7'])->assertUnprocessable();
    expect(DB::connection('pgsql_migration')->table('students')->where('church_id', $this->church->id)->count())->toBe(1);
});

it('allows Teachers assigned roster reads but denies writes and hides full birthdates', function () {
    $ministry = MembershipScenario::ministry($this->church->id);
    $unassignedMinistry = MembershipScenario::ministry($this->church->id);
    $studentId = (string) Str::uuid();
    DB::connection('pgsql_migration')->table('students')->insert(['id' => $studentId, 'church_id' => $this->church->id, 'first_name' => 'Ari', 'last_name' => 'Sprout', 'date_of_birth' => '2018-08-20', 'gender' => 'female', 'version' => 1, 'created_at' => now(), 'updated_at' => now()]);
    DB::connection('pgsql_migration')->table('enrollments')->insert(['id' => (string) Str::uuid(), 'church_id' => $this->church->id, 'student_id' => $studentId, 'ministry_id' => $ministry, 'version' => 1, 'created_at' => now(), 'updated_at' => now()]);
    DB::connection('pgsql_migration')->table('enrollments')->insert(['id' => (string) Str::uuid(), 'church_id' => $this->church->id, 'student_id' => $studentId, 'ministry_id' => $unassignedMinistry, 'version' => 1, 'created_at' => now(), 'updated_at' => now()]);
    $unassignedStudentId = (string) Str::uuid();
    DB::connection('pgsql_migration')->table('students')->insert(['id' => $unassignedStudentId, 'church_id' => $this->church->id, 'first_name' => 'Noah', 'last_name' => 'Hidden', 'date_of_birth' => '2017-03-14', 'gender' => 'male', 'version' => 1, 'created_at' => now(), 'updated_at' => now()]);
    DB::connection('pgsql_migration')->table('enrollments')->insert(['id' => (string) Str::uuid(), 'church_id' => $this->church->id, 'student_id' => $unassignedStudentId, 'ministry_id' => $unassignedMinistry, 'version' => 1, 'created_at' => now(), 'updated_at' => now()]);
    [$teacher, $membership] = ChurchScenario::teacher($this->church);
    User::findOrFail($teacher->id);
    $this->putJson('/api/teachers/'.$membership->id.'/assignments', ['ministry_ids' => [$ministry]])->assertOk();
    $teacher = User::findOrFail($teacher->id);
    $this->actingAs($teacher, 'web')->withSession(['password_hash_web' => $teacher->getAuthPassword()]);
    $response = $this->getJson('/api/students')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.birth_month_day', '08-20')->assertJsonPath('data.0.ministry_ids.0', $ministry);
    expect($response->json('data.0'))->not->toHaveKey('date_of_birth');
    expect($response->json('data.0.ministry_ids'))->not->toContain($unassignedMinistry);
    expect(collect($response->json('data'))->pluck('id')->all())->not->toContain($unassignedStudentId);
    $this->getJson('/api/students/'.$studentId)->assertOk()->assertJsonMissingPath('date_of_birth');
    $this->getJson('/api/students/'.$unassignedStudentId)->assertNotFound();
    $this->postJson('/api/students', ['first_name' => 'Ari', 'last_name' => 'Sprout'])->assertForbidden();
    $this->getJson('/api/ministries')->assertJsonPath('data.0.id', $ministry);
});

it('does not expose or return another church student', function () {
    [, $otherChurch] = ChurchScenario::owner();
    $foreign = (string) Str::uuid();
    DB::connection('pgsql_migration')->table('students')->insert(['id' => $foreign, 'church_id' => $otherChurch->id, 'first_name' => 'Private', 'last_name' => 'Child', 'gender' => 'unspecified', 'version' => 1, 'created_at' => now(), 'updated_at' => now()]);
    $this->getJson('/api/students/'.$foreign)->assertNotFound();
    $this->getJson('/api/students')->assertOk()->assertJsonCount(0, 'data');
});
