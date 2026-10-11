<?php

use App\Models\PlatformAdmin;
use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Tests\Support\PostgresTestDatabase;

beforeEach(function (): void {
    PostgresTestDatabase::refresh();
    config(['operations.readiness_token' => 'test-readiness-token']);
});

it('exposes a minimal public liveness response with hardened headers', function (): void {
    $this->getJson('/health/live')
        ->assertOk()
        ->assertExactJson(['status' => 'ok'])
        ->assertHeader('Cache-Control', 'no-store, private')
        ->assertHeader('X-Content-Type-Options', 'nosniff')
        ->assertHeader('Referrer-Policy', 'no-referrer')
        ->assertHeader('Content-Security-Policy');
});

it('protects readiness and returns component status without operational counts', function (): void {
    $this->getJson('/health/ready')->assertUnauthorized();

    Artisan::call('operations:scheduler-heartbeat');
    expect(Artisan::call('operations:scheduler-heartbeat', ['--check' => true]))->toBe(0);

    $response = $this->withHeader('X-Readiness-Token', 'test-readiness-token')
        ->getJson('/health/ready')
        ->assertOk()
        ->assertJsonPath('status', 'ready')
        ->assertJsonPath('checks.api', 'ok')
        ->assertJsonPath('checks.database', 'ok')
        ->assertJsonPath('checks.scheduler', 'ok');

    expect(array_keys($response->json('checks')))->toBe(['api', 'database', 'queue', 'scheduler'])
        ->and(json_encode($response->json(), JSON_THROW_ON_ERROR))->not->toContain('count', 'bytes', 'church', 'student');
});

it('limits sanitized aggregate health metrics to the active sage.dev session', function (): void {
    Artisan::call('operations:scheduler-heartbeat');

    $this->getJson('/platform/system-health')->assertUnauthorized();

    $admin = PlatformAdmin::factory()->active()->create(['handle' => 'sage.dev']);
    $response = $this->actingAs($admin, 'platform')->withSession(['platform.mfa' => true])
        ->getJson('/platform/system-health')
        ->assertOk()
        ->assertJsonStructure([
            'status', 'checked_at',
            'api' => ['status'],
            'database' => ['status', 'size_bytes', 'growth_bytes_24h'],
            'queue' => ['status', 'pending_count', 'oldest_age_seconds', 'failed_24h'],
            'scheduler' => ['status', 'last_run_at'],
            'birthdays' => ['status', 'last_dispatch_at', 'failed_24h'],
            'synchronization' => ['status', 'events_24h', 'rejected_24h', 'open_conflicts', 'error_rate'],
        ]);

    $encoded = json_encode($response->json(), JSON_THROW_ON_ERROR);
    expect($encoded)->not->toContain('church_id', 'student', 'child', 'token', 'password', 'endpoint');
});

it('does not borrow church authentication or weaken platform assurance for health and audit', function (): void {
    $this->actingAs(User::factory()->create(), 'web');
    foreach (['/platform/system-health', '/platform/audit-events'] as $path) {
        $this->getJson($path)->assertUnauthorized();
    }
    $actor = PlatformAdmin::factory()->active()->create(['handle' => 'sage.dev']);
    $this->actingAs($actor, 'platform');
    foreach (['/platform/system-health', '/platform/audit-events'] as $path) {
        $this->getJson($path)->assertForbidden();
    }
    $this->withSession(['platform.mfa' => true]);
    $this->getJson('/platform/system-health')->assertOk();
    $this->getJson('/health/ready')->assertUnauthorized();
    $actor->forceFill(['status' => 'disabled'])->save();
    foreach (['/platform/system-health', '/platform/audit-events'] as $path) {
        $this->getJson($path)->assertForbidden();
    }
});
