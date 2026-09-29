<?php

use App\Jobs\PruneOperationalData;
use App\Jobs\PurgeRevokedDeviceData;
use App\Models\ChurchApplication;
use App\Models\User;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\MembershipScenario;
use Tests\Support\PostgresTestDatabase;

beforeEach(fn () => PostgresTestDatabase::refresh());

it('applies bounded retention while preserving audit evidence and cursor safety', function (): void {
    [$owner, $church, $membership] = MembershipScenario::owner($this);
    $ministry = MembershipScenario::ministry($church->id);
    $db = DB::connection('pgsql_migration');
    $old = now('UTC')->subDays(200);
    $recent = now('UTC')->subDay();

    foreach ([[$old, 'old'], [$recent, 'recent']] as [$occurredAt, $suffix]) {
        $db->table('operational_events')->insert([
            'id' => (string) Str::uuid(), 'event_type' => 'api.error', 'severity' => 'error',
            'correlation_id' => (string) Str::uuid(), 'metadata_json' => json_encode(['category' => $suffix]),
            'occurred_at' => $occurredAt,
        ]);
        $db->table('security_events')->insert([
            'id' => (string) Str::uuid(), 'category' => 'security', 'church_id' => null,
            'actor_type' => 'anonymous', 'actor_id' => null, 'action' => 'auth.login_failed',
            'target_type' => 'session', 'target_id' => null, 'result' => 'failure',
            'correlation_id' => (string) Str::uuid(), 'metadata_json' => '{}', 'occurred_at' => $occurredAt,
        ]);
        $db->table('sync_events')->insert([
            'id' => (string) Str::uuid(), 'church_id' => $church->id, 'device_id' => (string) Str::uuid(),
            'client_event_id' => (string) Str::uuid(), 'batch_id' => (string) Str::uuid(), 'actor_id' => $owner->id,
            'payload_hash' => hash('sha256', $suffix), 'result_status' => 'accepted',
            'received_at' => $occurredAt, 'correlation_id' => (string) Str::uuid(),
        ]);
    }
    $db->table('operational_events')->insert(array_map(static fn (int $index): array => [
        'id' => (string) Str::uuid(), 'event_type' => 'api.error', 'severity' => 'error',
        'correlation_id' => (string) Str::uuid(), 'metadata_json' => json_encode(['batch' => $index]),
        'occurred_at' => $old,
    ], range(1, 1000)));

    $auditId = (string) Str::uuid();
    $db->table('audit_events')->insert([
        'id' => $auditId, 'category' => 'platform', 'church_id' => null, 'actor_type' => 'system',
        'actor_id' => null, 'action' => 'system.retention.baseline', 'target_type' => 'system',
        'target_id' => null, 'result' => 'success', 'correlation_id' => (string) Str::uuid(),
        'metadata_json' => '{}', 'occurred_at' => $old,
    ]);

    $oldFeed = $db->table('change_feed')->insertGetId([
        'id' => (string) Str::uuid(), 'church_id' => $church->id, 'ministry_id' => $ministry,
        'entity_type' => 'attendance_session', 'entity_id' => (string) Str::uuid(), 'entity_version' => 1,
        'action' => 'upsert', 'payload_json' => '{}', 'created_at' => now('UTC')->subDays(100),
    ], 'sequence');
    $protectedFeed = $db->table('change_feed')->insertGetId([
        'id' => (string) Str::uuid(), 'church_id' => $church->id, 'ministry_id' => $ministry,
        'entity_type' => 'attendance_session', 'entity_id' => (string) Str::uuid(), 'entity_version' => 1,
        'action' => 'upsert', 'payload_json' => '{}', 'created_at' => now('UTC')->subDays(100),
    ], 'sequence');

    $activeDevice = (string) Str::uuid();
    $expiredDevice = (string) Str::uuid();
    $purgedDevice = (string) Str::uuid();
    foreach ([
        [$activeDevice, now('UTC')->addDay()],
        [$expiredDevice, now('UTC')->subDay()],
        [$purgedDevice, now('UTC')->subDays(181)],
    ] as [$deviceId, $expiresAt]) {
        $db->table('offline_authorizations')->insert([
            'id' => (string) Str::uuid(), 'church_id' => $church->id, 'membership_id' => $membership->id,
            'device_id' => $deviceId, 'expires_at' => $expiresAt,
        ]);
        $db->table('device_cursors')->insert([
            'id' => (string) Str::uuid(), 'church_id' => $church->id, 'membership_id' => $membership->id,
            'device_id' => $deviceId, 'cursor' => $deviceId === $activeDevice ? $oldFeed : 0,
            'updated_at' => $old,
        ]);
    }
    $subscriptionId = (string) Str::uuid();
    $endpoint = 'https://fcm.googleapis.com/fcm/send/'.$expiredDevice;
    $db->table('push_subscriptions')->insert([
        'id' => $subscriptionId, 'church_id' => $church->id, 'membership_id' => $membership->id,
        'user_id' => $owner->id, 'device_id' => (string) Str::uuid(),
        'endpoint_hash' => hash('sha256', $endpoint), 'endpoint_ciphertext' => Crypt::encryptString($endpoint),
        'p256dh_ciphertext' => Crypt::encryptString('public-key'), 'auth_ciphertext' => Crypt::encryptString('auth-secret'),
        'content_encoding' => 'aes128gcm', 'permission_state' => 'denied', 'failure_count' => 0,
        'revoked_at' => now('UTC')->subDays(31), 'created_at' => $old, 'updated_at' => $old,
    ]);

    $applicant = User::factory()->create();
    $application = ChurchApplication::create([
        'user_id' => $applicant->id, 'status' => 'rejected', 'church_name' => 'Private Church',
        'city' => 'Private City', 'address' => 'Private address', 'timezone' => 'Asia/Manila',
        'duplicate_key' => hash('sha256', 'private'), 'category' => 'incomplete', 'reason' => 'Private reason',
        'decided_at' => now('UTC')->subDays(31), 'decided_by' => (string) Str::uuid(),
        'correlation_id' => (string) Str::uuid(),
    ]);

    app()->call([new PurgeRevokedDeviceData, 'handle']);
    app()->call([new PruneOperationalData, 'handle']);

    expect($db->table('operational_events')->count())->toBe(1)
        ->and($db->table('security_events')->count())->toBe(1)
        ->and($db->table('sync_events')->count())->toBe(1)
        ->and($db->table('audit_events')->where('id', $auditId)->exists())->toBeTrue()
        ->and($db->table('change_feed')->where('sequence', $oldFeed)->exists())->toBeFalse()
        ->and($db->table('change_feed')->where('sequence', $protectedFeed)->exists())->toBeTrue()
        ->and($db->table('device_cursors')->where('device_id', $expiredDevice)->value('full_resync_required'))->toBeTrue()
        ->and($db->table('offline_authorizations')->where('device_id', $purgedDevice)->exists())->toBeFalse()
        ->and($db->table('device_cursors')->where('device_id', $purgedDevice)->value('full_resync_required'))->toBeTrue()
        ->and($db->table('push_subscriptions')->where('id', $subscriptionId)->value('endpoint_ciphertext'))->toBeNull()
        ->and($db->table('push_subscriptions')->where('id', $subscriptionId)->value('endpoint_hash'))->toBeNull()
        ->and($application->fresh()->reason)->toBeNull();
});

it('keeps retention privileges behind narrow database functions', function (): void {
    $runtimeRole = (string) env('DB_RUNTIME_USERNAME');
    $db = DB::connection('pgsql_migration');

    foreach (['operational_events', 'security_events', 'sync_events', 'change_feed'] as $table) {
        expect((bool) $db->scalar('SELECT has_table_privilege(?, ?, ?)', [$runtimeRole, $table, 'DELETE']))->toBeFalse();
    }

    expect((bool) $db->scalar("SELECT has_function_privilege(?, 'prune_operational_data(timestamptz,timestamptz,timestamptz,timestamptz)', 'EXECUTE')", [$runtimeRole]))->toBeTrue()
        ->and((bool) $db->scalar('SELECT has_table_privilege(?, ?, ?)', [$runtimeRole, 'system_heartbeats', 'SELECT']))->toBeTrue()
        ->and((bool) $db->scalar("SELECT has_function_privilege('public', 'prune_operational_data(timestamptz,timestamptz,timestamptz,timestamptz)', 'EXECUTE')"))->toBeFalse();
});
