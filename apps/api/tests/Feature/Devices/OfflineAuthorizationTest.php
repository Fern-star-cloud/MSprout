<?php

use App\Domain\Audit\AuditWriter;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\ChurchScenario;
use Tests\Support\MembershipScenario;
use Tests\Support\PostgresTestDatabase;

beforeEach(function () {
    PostgresTestDatabase::refresh();
    [$this->owner, $this->church, $this->ownerMembership] = MembershipScenario::owner($this);
    $this->deviceId = (string) Str::uuid();
});

it('prepares all active Owner ministries without creating attendance or another membership device', function () {
    $firstMinistry = MembershipScenario::ministry($this->church->id);
    DB::connection('pgsql_migration')->table('ministries')->where('id', $firstMinistry)->update(['name' => 'First synthetic ministry']);
    $secondMinistry = MembershipScenario::ministry($this->church->id);
    DB::connection('pgsql_migration')->table('ministries')->where('id', $secondMinistry)->update(['name' => 'Second synthetic ministry']);
    $archived = MembershipScenario::ministry($this->church->id);
    DB::connection('pgsql_migration')->table('ministries')->where('id', $archived)->update(['archived_at' => now()]);
    [, $otherChurch] = ChurchScenario::owner();
    $foreign = MembershipScenario::ministry($otherChurch->id);

    $response = $this->getJson('/api/offline/bootstrap?device_id='.$this->deviceId)->assertOk();
    expect(collect($response->json('ministries'))->pluck('id')->sort()->values()->all())
        ->toBe(collect([$firstMinistry, $secondMinistry])->sort()->values()->all())
        ->not->toContain($archived, $foreign);
    $this->getJson('/api/offline/bootstrap?device_id='.$this->deviceId)->assertOk();
    foreach (['attendance_sessions', 'attendance_records'] as $table) {
        expect(DB::connection('pgsql_migration')->table($table)->count())->toBe(0);
    }
    expect(DB::connection('pgsql_migration')->table('offline_authorizations')->count())->toBe(1)
        ->and(DB::connection('pgsql_migration')->table('device_cursors')->count())->toBe(1);
});

it('returns an empty authorized scope for an unassigned Teacher without leaking Owner or foreign ministries', function () {
    MembershipScenario::ministry($this->church->id);
    [$teacher] = ChurchScenario::teacher($this->church);
    $teacher = User::findOrFail($teacher->id);
    $this->actingAs($teacher, 'web')->withSession(['password_hash_web' => $teacher->getAuthPassword()]);

    $this->getJson('/api/offline/bootstrap?device_id='.$this->deviceId)->assertOk()
        ->assertJsonPath('actor.id', (string) $teacher->id)
        ->assertJsonPath('ministries', [])->assertJsonPath('roster', []);
    expect(DB::connection('pgsql_migration')->table('attendance_sessions')->count())->toBe(0)
        ->and(DB::connection('pgsql_migration')->table('attendance_records')->count())->toBe(0);
});

it('issues a signed 14-day lease with only an assigned Teacher roster projection', function () {
    $assigned = MembershipScenario::ministry($this->church->id);
    $hidden = MembershipScenario::ministry($this->church->id);
    $student = (string) Str::uuid();
    DB::connection('pgsql_migration')->table('students')->insert([
        'id' => $student, 'church_id' => $this->church->id, 'first_name' => 'Ana', 'last_name' => 'Sprout',
        'date_of_birth' => '2018-10-20', 'gender' => 'female', 'version' => 2, 'created_at' => now(), 'updated_at' => now(),
    ]);
    foreach ([$assigned, $hidden] as $ministry) {
        DB::connection('pgsql_migration')->table('enrollments')->insert([
            'id' => (string) Str::uuid(), 'church_id' => $this->church->id, 'student_id' => $student,
            'ministry_id' => $ministry, 'version' => 1, 'created_at' => now(), 'updated_at' => now(),
        ]);
    }
    [$teacher, $membership] = ChurchScenario::teacher($this->church);
    DB::connection('pgsql_migration')->table('teacher_ministry_assignments')->insert([
        'id' => (string) Str::uuid(), 'church_id' => $this->church->id, 'membership_id' => $membership->id,
        'ministry_id' => $assigned, 'assigned_by' => $this->owner->id, 'created_at' => now(), 'updated_at' => now(),
    ]);
    $teacher = User::findOrFail($teacher->id);
    $this->actingAs($teacher, 'web')->withSession(['password_hash_web' => $teacher->getAuthPassword()]);

    $response = $this->getJson('/api/offline/bootstrap?device_id='.$this->deviceId)
        ->assertOk()->assertJsonPath('actor.id', (string) $teacher->id)
        ->assertJsonPath('ministries.0.id', $assigned)
        ->assertJsonPath('roster.0.id', $student)
        ->assertJsonPath('roster.0.display_name', 'Ana Sprout')
        ->assertJsonPath('roster.0.next_birthday_month_day', '10-20')
        ->assertJsonPath('roster.0.turning_age', 8)
        ->assertJsonPath('roster.0.ministry_ids.0', $assigned)
        ->assertJsonMissingPath('roster.0.date_of_birth')
        ->assertJsonMissingPath('roster.0.first_name');

    expect($response->json('ministries'))->toHaveCount(1)
        ->and($response->json('roster.0.ministry_ids'))->not->toContain($hidden)
        ->and($response->json('lease.signature'))->toMatch('/\A[a-f0-9]{64}\z/')
        ->and(now()->diffInDays($response->json('lease.expires_at'), false))->toBeBetween(13.9, 14.1)
        ->and($response->json('server_cursor'))->toBeString();
    expect(DB::connection('pgsql_migration')->table('offline_authorizations')
        ->where('membership_id', $membership->id)->where('device_id', $this->deviceId)->whereNull('revoked_at')->count())->toBe(1);
});

it('renews one device authorization only for a verified active session and records audit evidence', function () {
    $first = $this->getJson('/api/offline/bootstrap?device_id='.$this->deviceId)->assertOk();
    $authorization = DB::connection('pgsql_migration')->table('offline_authorizations')->where('device_id', $this->deviceId)->first();
    DB::connection('pgsql_migration')->table('offline_authorizations')->where('id', $authorization->id)
        ->update(['expires_at' => now()->subDay(), 'revoked_at' => now()]);
    DB::connection('pgsql_migration')->table('device_cursors')->where('device_id', $this->deviceId)
        ->update(['full_resync_required' => true]);

    $second = $this->getJson('/api/offline/bootstrap?device_id='.$this->deviceId)->assertOk();

    expect($second->json('lease.expires_at'))->not->toBe($first->json('lease.expires_at'))
        ->and(DB::connection('pgsql_migration')->table('offline_authorizations')->where('device_id', $this->deviceId)->count())->toBe(1)
        ->and(DB::connection('pgsql_migration')->table('offline_authorizations')->where('device_id', $this->deviceId)->value('revoked_at'))->toBeNull()
        ->and(DB::connection('pgsql_migration')->table('device_cursors')->where('device_id', $this->deviceId)->value('full_resync_required'))->toBeFalse()
        ->and(DB::connection('pgsql_migration')->table('audit_events')->where('action', 'offline.authorization.issued')->count())->toBe(2);
});

it('rolls back the device authorization when required audit evidence cannot persist', function () {
    $this->mock(AuditWriter::class)->shouldReceive('record')->once()->andThrow(new RuntimeException('private-marker'));

    $this->getJson('/api/offline/bootstrap?device_id='.$this->deviceId)
        ->assertStatus(500)->assertJsonPath('code', 'internal_error');

    expect(DB::connection('pgsql_migration')->table('offline_authorizations')->where('device_id', $this->deviceId)->count())->toBe(0);
});

it('rejects unauthenticated, malformed, inactive, and cross-tenant bootstrap requests', function () {
    auth()->guard('web')->logout();
    $this->getJson('/api/offline/bootstrap?device_id='.$this->deviceId)->assertUnauthorized();

    $this->actingAs($this->owner, 'web')->withHeader('X-Church-Id', $this->church->id)->withSession(['church_mfa_user_id' => $this->owner->id]);
    $this->getJson('/api/offline/bootstrap?device_id=not-a-uuid')->assertUnprocessable();
    [, $foreignChurch] = ChurchScenario::owner();
    $this->withHeader('X-Church-Id', $foreignChurch->id)
        ->getJson('/api/offline/bootstrap?device_id='.$this->deviceId)->assertForbidden();

    [$teacher, $teacherMembership] = ChurchScenario::teacher($this->church);
    $teacher = User::findOrFail($teacher->id);
    DB::connection('pgsql_migration')->table('church_memberships')->where('id', $teacherMembership->id)->update(['status' => 'revoked']);
    $this->actingAs($teacher, 'web')->withSession(['password_hash_web' => $teacher->getAuthPassword()]);
    $this->withHeader('X-Church-Id', $this->church->id)
        ->getJson('/api/offline/bootstrap?device_id='.$this->deviceId)->assertForbidden();
});
