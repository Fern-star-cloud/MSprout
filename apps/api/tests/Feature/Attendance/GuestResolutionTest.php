<?php

use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\ChurchScenario;
use Tests\Support\MembershipScenario;
use Tests\Support\PostgresTestDatabase;

beforeEach(function (): void {
    PostgresTestDatabase::refresh();
    [$this->owner, $this->church, $this->membership] = MembershipScenario::owner($this);
    $this->ministryId = MembershipScenario::ministry($this->church->id);
    $this->deviceId = (string) Str::uuid();
    $this->sessionId = (string) Str::uuid();
    DB::connection('pgsql_migration')->table('offline_authorizations')->insert([
        'id' => (string) Str::uuid(), 'church_id' => $this->church->id,
        'membership_id' => $this->membership->id, 'device_id' => $this->deviceId,
        'expires_at' => now()->addDays(14),
    ]);
    task14Push($this, [task14Event($this, 'attendance.draft_created', 0, [
        'ministry_id' => $this->ministryId,
        'attendance_date' => '2026-09-29',
        'student_ids' => [],
    ])])->assertOk();
});

it('accepts only minimal offline guest data and keeps its original actor and local time when promoted', function (): void {
    $guestId = (string) Str::uuid();
    task14Push($this, [task14Event($this, 'attendance.guest_added', 1, [
        'display_name' => 'Guest Child', 'gender' => 'female',
    ], $guestId)])->assertOk()->assertJsonPath('results.0.status', 'accepted');

    task14Push($this, [task14Event($this, 'attendance.guest_added', 2, [
        'display_name' => 'Unsafe Guest', 'guardian_phone' => 'not-accepted',
    ])])->assertOk()->assertJsonPath('results.0.status', 'rejected')->assertJsonPath('results.0.reason', 'invalid_payload');
    $this->getJson('/api/attendance-guests')->assertOk()->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.display_name', 'Guest Child')
        ->assertJsonPath('data.0.device_id', $this->deviceId);

    [$teacher] = ChurchScenario::teacher($this->church);
    $teacher = User::findOrFail($teacher->id);
    $this->actingAs($teacher, 'web')->withSession(['password_hash_web' => $teacher->getAuthPassword()]);
    $this->postJson('/api/attendance-guests/'.$guestId.'/promote', [
        'first_name' => 'Guest', 'last_name' => 'Child', 'gender' => 'female',
    ])->assertForbidden();
    $this->getJson('/api/attendance-guests')->assertForbidden();

    $this->actingAs($this->owner, 'web')->withSession([
        'church_mfa_user_id' => $this->owner->id,
        'password_hash_web' => $this->owner->getAuthPassword(),
    ]);

    $this->postJson('/api/attendance-guests/'.$guestId.'/promote', [
        'first_name' => 'Guest', 'last_name' => 'Child', 'gender' => 'female',
    ])->assertOk()->assertJsonPath('status', 'promoted');

    $db = DB::connection('pgsql_migration');
    $guest = $db->table('attendance_guests')->where('id', $guestId)->first();
    $record = $db->table('attendance_records')->where('source_guest_id', $guestId)->first();
    expect($db->table('attendance_guests')->count())->toBe(1)
        ->and($guest->created_by)->toBe($this->owner->id)
        ->and($guest->source_device_id)->toBe($this->deviceId)
        ->and(CarbonImmutable::parse($guest->occurred_at)->toISOString())->toStartWith('2026-09-29T02:03:04')
        ->and($guest->resolved_student_id)->not->toBeNull()
        ->and($record->student_id)->toBe($guest->resolved_student_id)
        ->and($record->state)->toBe('present')
        ->and($record->recorded_by)->toBe($this->owner->id)
        ->and($record->recorded_device_id)->toBe($this->deviceId)
        ->and(CarbonImmutable::parse($record->recorded_at)->toISOString())->toStartWith('2026-09-29T02:03:04')
        ->and($db->table('audit_events')->where('action', 'attendance.guest.promoted')->count())->toBe(1);
});

it('links a guest to an existing student and merges a duplicate without losing either provenance record', function (): void {
    $studentId = (string) Str::uuid();
    DB::connection('pgsql_migration')->table('students')->insert([
        'id' => $studentId, 'church_id' => $this->church->id, 'first_name' => 'Known',
        'last_name' => 'Student', 'gender' => 'unspecified', 'version' => 1,
        'created_at' => now(), 'updated_at' => now(),
    ]);
    $canonicalId = (string) Str::uuid();
    $duplicateId = (string) Str::uuid();
    task14Push($this, [
        task14Event($this, 'attendance.guest_added', 1, ['display_name' => 'Known Student'], $canonicalId),
        task14Event($this, 'attendance.guest_added', 2, ['display_name' => 'Known Student'], $duplicateId),
    ])->assertOk();

    $this->postJson('/api/attendance-guests/'.$canonicalId.'/link', ['student_id' => $studentId])
        ->assertOk()->assertJsonPath('status', 'linked');
    $this->postJson('/api/attendance-guests/'.$duplicateId.'/merge', ['guest_id' => $canonicalId])
        ->assertOk()->assertJsonPath('status', 'merged');

    $db = DB::connection('pgsql_migration');
    expect($db->table('attendance_guests')->where('id', $canonicalId)->value('resolved_student_id'))->toBe($studentId)
        ->and($db->table('attendance_guests')->where('id', $duplicateId)->value('merged_into_guest_id'))->toBe($canonicalId)
        ->and($db->table('attendance_guests')->count())->toBe(2)
        ->and($db->table('attendance_records')->where('source_guest_id', $canonicalId)->value('recorded_at'))->not->toBeNull();
});
