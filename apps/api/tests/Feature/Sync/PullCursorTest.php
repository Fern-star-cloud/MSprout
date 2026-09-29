<?php

use App\Models\User;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\ChurchScenario;
use Tests\Support\MembershipScenario;
use Tests\Support\PostgresTestDatabase;

beforeEach(function (): void {
    PostgresTestDatabase::refresh();
    [$this->owner, $this->church, $this->ownerMembership] = MembershipScenario::owner($this);
    $this->assignedMinistry = MembershipScenario::ministry($this->church->id);
    $this->hiddenMinistry = MembershipScenario::ministry($this->church->id);
    $this->deviceId = (string) Str::uuid();
    grantPullDevice($this->ownerMembership->id, $this->church->id, $this->deviceId);
});

function grantPullDevice(string $membershipId, string $churchId, string $deviceId): void
{
    DB::connection('pgsql_migration')->table('offline_authorizations')->insert([
        'id' => (string) Str::uuid(), 'church_id' => $churchId, 'membership_id' => $membershipId,
        'device_id' => $deviceId, 'expires_at' => now()->addDays(14),
    ]);
}

function feedEntry(object $test, string $ministryId, string $action = 'upsert', ?string $membershipId = null): int
{
    return (int) DB::connection('pgsql_migration')->table('change_feed')->insertGetId([
        'id' => (string) Str::uuid(),
        'church_id' => $test->church->id,
        'ministry_id' => $ministryId,
        'target_membership_id' => $membershipId,
        'entity_type' => $membershipId ? 'ministry_assignment' : 'attendance_session',
        'entity_id' => (string) Str::uuid(),
        'entity_version' => 1,
        'action' => $action,
        'payload_json' => json_encode($membershipId ? ['ministry_id' => $ministryId] : ['status' => 'draft', 'records' => []], JSON_THROW_ON_ERROR),
        'created_at' => now(),
    ], 'sequence');
}

it('returns ordered bounded changes, advances a durable cursor, and renews the lease', function (): void {
    $first = feedEntry($this, $this->assignedMinistry);
    $second = feedEntry($this, $this->assignedMinistry);

    $response = $this->withHeader('X-Device-Id', $this->deviceId)
        ->getJson('/api/sync/pull?cursor=0&limit=1')
        ->assertOk()
        ->assertJsonCount(1, 'changes')
        ->assertJsonPath('changes.0.sequence', (string) $first)
        ->assertJsonPath('page.next_cursor', (string) $first)
        ->assertJsonPath('page.has_more', true)
        ->assertJsonPath('lease.device_id', $this->deviceId);

    $next = $this->withHeader('X-Device-Id', $this->deviceId)
        ->getJson('/api/sync/pull?cursor='.$response->json('page.next_cursor').'&limit=10')
        ->assertOk()
        ->assertJsonPath('changes.0.sequence', (string) $second)
        ->assertJsonPath('page.next_cursor', (string) $second)
        ->assertJsonPath('page.has_more', false);

    expect(DB::connection('pgsql_migration')->table('device_cursors')->where('device_id', $this->deviceId)->value('cursor'))->toBe($second)
        ->and(DB::connection('pgsql_migration')->table('offline_authorizations')->where('device_id', $this->deviceId)->value('expires_at'))->not->toBeNull()
        ->and($next->json('changes'))->toHaveCount(1);
});

it('filters attendance to current assignments while delivering targeted revocation tombstones', function (): void {
    [$teacher, $membership] = ChurchScenario::teacher($this->church);
    DB::connection('pgsql_migration')->table('teacher_ministry_assignments')->insert([
        'id' => (string) Str::uuid(), 'church_id' => $this->church->id, 'membership_id' => $membership->id,
        'ministry_id' => $this->assignedMinistry, 'assigned_by' => $this->owner->id, 'created_at' => now(), 'updated_at' => now(),
    ]);
    $visible = feedEntry($this, $this->assignedMinistry);
    feedEntry($this, $this->hiddenMinistry);
    $tombstone = feedEntry($this, $this->hiddenMinistry, 'tombstone', $membership->id);
    $teacherDevice = (string) Str::uuid();
    grantPullDevice($membership->id, $this->church->id, $teacherDevice);
    $teacher = User::findOrFail($teacher->id);
    $this->actingAs($teacher, 'web')->withSession(['password_hash_web' => $teacher->getAuthPassword()]);

    $response = $this->withHeader('X-Device-Id', $teacherDevice)
        ->getJson('/api/sync/pull?cursor=0&limit=100')
        ->assertOk()
        ->assertJsonCount(2, 'changes')
        ->assertJsonPath('changes.0.sequence', (string) $visible)
        ->assertJsonPath('changes.1.sequence', (string) $tombstone)
        ->assertJsonPath('changes.1.action', 'tombstone')
        ->assertJsonPath('page.next_cursor', (string) $tombstone)
        ->assertJsonPath('page.has_more', false);

    expect(collect($response->json('changes'))->pluck('ministry_id')->all())
        ->toBe([$this->assignedMinistry, $this->hiddenMinistry]);
});

it('never exposes another church feed and rejects an unauthorized device', function (): void {
    [, $foreignChurch] = ChurchScenario::owner();
    $foreignMinistry = MembershipScenario::ministry($foreignChurch->id);
    DB::connection('pgsql_migration')->table('change_feed')->insert([
        'id' => (string) Str::uuid(), 'church_id' => $foreignChurch->id, 'ministry_id' => $foreignMinistry,
        'entity_type' => 'attendance_session', 'entity_id' => (string) Str::uuid(), 'entity_version' => 1,
        'action' => 'upsert', 'payload_json' => json_encode(['status' => 'draft', 'records' => []], JSON_THROW_ON_ERROR), 'created_at' => now(),
    ]);
    feedEntry($this, $this->assignedMinistry);

    $this->withHeader('X-Device-Id', $this->deviceId)
        ->getJson('/api/sync/pull?cursor=0&limit=100')
        ->assertOk()
        ->assertJsonCount(1, 'changes');

    $this->withHeader('X-Device-Id', (string) Str::uuid())
        ->getJson('/api/sync/pull?cursor=0')
        ->assertForbidden();
});

it('publishes a targeted tombstone when an Owner removes a Teacher assignment', function (): void {
    [, $membership] = ChurchScenario::teacher($this->church);
    DB::connection('pgsql_migration')->table('teacher_ministry_assignments')->insert([
        'id' => (string) Str::uuid(), 'church_id' => $this->church->id, 'membership_id' => $membership->id,
        'ministry_id' => $this->assignedMinistry, 'assigned_by' => $this->owner->id, 'created_at' => now(), 'updated_at' => now(),
    ]);

    $this->putJson('/api/teachers/'.$membership->id.'/assignments', ['ministry_ids' => []])->assertOk();

    $entry = DB::connection('pgsql_migration')->table('change_feed')->where('target_membership_id', $membership->id)->first();
    expect($entry)->not->toBeNull()
        ->and($entry->action)->toBe('tombstone')
        ->and($entry->ministry_id)->toBe($this->assignedMinistry)
        ->and(json_decode($entry->payload_json, true, flags: JSON_THROW_ON_ERROR))->toBe(['ministry_id' => $this->assignedMinistry]);
});

it('forces tenant RLS and keeps receipts and feed append only for the runtime role', function (): void {
    $runtimeRole = (string) env('DB_RUNTIME_USERNAME');
    $tables = DB::connection('pgsql_migration')->select(<<<'SQL'
        SELECT c.relname AS name, c.relrowsecurity::int AS rls, c.relforcerowsecurity::int AS forced,
               has_table_privilege(?, c.oid, 'SELECT')::int AS selectable,
               has_table_privilege(?, c.oid, 'INSERT')::int AS insertable,
               has_table_privilege(?, c.oid, 'UPDATE')::int AS updatable,
               has_table_privilege(?, c.oid, 'DELETE')::int AS deletable
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = current_schema()
          AND c.relname IN ('sync_events', 'change_feed', 'device_cursors')
        ORDER BY c.relname
        SQL, [$runtimeRole, $runtimeRole, $runtimeRole, $runtimeRole]);

    expect($tables)->toHaveCount(3);
    foreach ($tables as $table) {
        expect([(int) $table->rls, (int) $table->forced, (int) $table->selectable, (int) $table->insertable, (int) $table->deletable])->toBe([1, 1, 1, 1, 0]);
        expect((int) $table->updatable)->toBe($table->name === 'device_cursors' ? 1 : 0);
    }

    [, $foreignChurch] = ChurchScenario::owner();
    $foreignMinistry = MembershipScenario::ministry($foreignChurch->id);
    expect(fn () => app(TenantContext::class)->run($this->church->id, fn () => DB::table('change_feed')->insert([
        'id' => (string) Str::uuid(), 'church_id' => $foreignChurch->id, 'ministry_id' => $foreignMinistry,
        'entity_type' => 'attendance_session', 'entity_id' => (string) Str::uuid(), 'entity_version' => 1,
        'action' => 'upsert', 'payload_json' => json_encode([], JSON_THROW_ON_ERROR), 'created_at' => now(),
    ])))->toThrow(QueryException::class);
});
