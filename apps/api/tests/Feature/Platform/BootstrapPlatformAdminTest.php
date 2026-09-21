<?php

use App\Mail\PlatformAdminSetupMail;
use App\Models\PlatformAdmin;
use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Tests\Support\PostgresTestDatabase;

beforeEach(function (): void {
    PostgresTestDatabase::refresh();
});

it('stores platform identities outside church user and membership tables', function (): void {
    expect(Schema::hasTable('platform_admins'))->toBeTrue();
});

it('registers a passwordless platform administrator bootstrap command', function (): void {
    $commands = Artisan::all();

    expect($commands)->toHaveKey('platform:bootstrap-admin')
        ->and($commands['platform:bootstrap-admin']->getDefinition()->hasOption('password'))->toBeFalse();
});

it('creates one pending sage.dev invitation without accepting a password', function (): void {
    Mail::fake();

    $this->artisan('platform:bootstrap-admin', [
        '--handle' => 'sage.dev',
        '--email' => 'developer@example.com',
    ])->assertSuccessful();

    $admin = PlatformAdmin::query()->where('handle', 'sage.dev')->first();

    expect($admin)->not->toBeNull()
        ->and($admin->recovery_email)->toBe('developer@example.com')
        ->and($admin->password)->toBeNull()
        ->and($admin->status)->toBe('pending')
        ->and($admin->setup_expires_at->isFuture())->toBeTrue();

    Mail::assertQueued(
        PlatformAdminSetupMail::class,
        fn (PlatformAdminSetupMail $mail): bool => $mail->admin->is($admin)
            && str_contains($mail->setupUrl(), '/platform/setup/'),
    );
});

it('rejects a second active sage.dev bootstrap', function (): void {
    Mail::fake();
    PlatformAdmin::factory()->create([
        'handle' => 'sage.dev',
        'recovery_email' => 'existing@example.com',
        'status' => 'active',
    ]);

    $this->artisan('platform:bootstrap-admin', [
        '--handle' => 'sage.dev',
        '--email' => 'replacement@example.com',
    ])->assertFailed();

    expect(PlatformAdmin::query()->where('handle', 'sage.dev')->count())->toBe(1);
    Mail::assertNothingQueued();
});

it('does not accept a church user session on platform routes', function (): void {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->getJson('/platform/me')
        ->assertUnauthorized();
});

it('starts platform requests with a distinct session cookie', function (): void {
    $response = $this->getJson('/platform/csrf-token');

    $response->assertOk()->assertJsonStructure(['csrf_token']);

    expect($response->headers->getCookies())
        ->toHaveCount(1)
        ->and($response->headers->getCookies()[0]->getName())
        ->toBe('ministrysprout_platform_session');
});
