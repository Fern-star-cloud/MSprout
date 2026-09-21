<?php

use App\Actions\Applications\RecordApplicationDecision;
use App\Mail\ChurchApplicationDecisionMail;
use App\Models\ChurchApplication;
use App\Models\PlatformAdmin;
use App\Models\User;
use App\Support\Captcha\CaptchaVerifier;
use Illuminate\Contracts\Mail\Mailer;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Tests\Support\PostgresTestDatabase;

beforeEach(function () {
    PostgresTestDatabase::refresh();
    $this->mock(CaptchaVerifier::class)->shouldReceive('verify')->andReturn(true);
});

it('does not expose recipient data in background mail failures', function () {
    $mailer = Mockery::mock(Mailer::class);
    $mailer->shouldReceive('send')->andThrow(new RuntimeException('Delivery rejected for private@example.test'));
    try {
        (new ChurchApplicationDecisionMail('approved'))->send($mailer);
        $this->fail('Expected a delivery failure.');
    } catch (RuntimeException $exception) {
        expect($exception->getMessage())->toBe('Application decision email delivery failed.');
        expect($exception->getPrevious())->toBeNull();
    }
});

it('persists one encrypted notification in the same database transaction', function () {
    $user = User::factory()->create();
    $id = $this->actingAs($user, 'web')->postJson('/api/church-applications', ['church_name' => 'Grace Church', 'city' => 'Davao City', 'timezone' => 'Asia/Manila', 'captcha_token' => 'test-proof'])->assertCreated()->json('id');
    $this->actingAs(PlatformAdmin::factory()->active()->create(['handle' => 'sage.dev']), 'platform')->withSession(['platform.mfa' => true]);
    $this->postJson('/platform/applications/'.$id.'/approve')->assertOk();
    $this->postJson('/platform/applications/'.$id.'/approve')->assertOk();
    expect(DB::table('jobs')->count())->toBe(1);
    $payload = DB::table('jobs')->value('payload');
    expect($payload)->not->toContain($user->email)->not->toContain('Grace Church');
    expect(json_decode($payload, true)['data']['command'])->not->toContain('ChurchApplicationDecisionMail');
});

it('reports unexpected failures with correlation only and rolls back the decision', function () {
    $this->actingAs(User::factory()->create(), 'web');
    $id = $this->postJson('/api/church-applications', ['church_name' => 'Grace Church', 'city' => 'Davao City', 'timezone' => 'Asia/Manila', 'captcha_token' => 'test-proof'])->json('id');
    $correlation = (string) Str::uuid();
    Log::spy();
    $this->mock(RecordApplicationDecision::class)->shouldReceive('handle')->andThrow(new RuntimeException('sensitive exception marker'));
    $this->actingAs(PlatformAdmin::factory()->active()->create(['handle' => 'sage.dev']), 'platform')->withSession(['platform.mfa' => true])->withHeader('X-Correlation-Id', $correlation);
    $this->postJson('/platform/applications/'.$id.'/approve')->assertStatus(500)->assertJsonMissingPath('exception');
    Log::shouldHaveReceived('error')->once()->with('Church application operation failed.', ['correlation_id' => $correlation]);
    expect(DB::table('jobs')->count())->toBe(0);
    expect(DB::connection('pgsql_migration')->table('churches')->count())->toBe(0);
});

it('enforces CSRF for application and platform decision mutations', function () {
    $this->app->instance('env', 'local');
    $this->withHeader('Origin', config('app.url'))->actingAs(User::factory()->create(), 'web')
        ->postJson('/api/church-applications', ['church_name' => 'Grace Church', 'city' => 'Davao City', 'timezone' => 'Asia/Manila', 'captcha_token' => 'test-proof'])->assertStatus(419);
    $this->actingAs(PlatformAdmin::factory()->active()->create(['handle' => 'sage.dev']), 'platform')->withSession(['platform.mfa' => true])
        ->postJson('/platform/applications/'.Str::uuid().'/approve')->assertStatus(419);
});

it('rechecks applicant verification at approval time', function () {
    $user = User::factory()->create();
    $id = $this->actingAs($user, 'web')->postJson('/api/church-applications', ['church_name' => 'Grace Church', 'city' => 'Davao City', 'timezone' => 'Asia/Manila', 'captcha_token' => 'test-proof'])->json('id');
    $user->forceFill(['email_verified_at' => null])->save();
    $this->actingAs(PlatformAdmin::factory()->active()->create(['handle' => 'sage.dev']), 'platform')->withSession(['platform.mfa' => true])
        ->postJson('/platform/applications/'.$id.'/approve')->assertForbidden();
});

it('rolls back the audit and approval if the database notification queue cannot persist', function () {
    $id = $this->actingAs(User::factory()->create(), 'web')->postJson('/api/church-applications', ['church_name' => 'Grace Church', 'city' => 'Davao City', 'timezone' => 'Asia/Manila', 'captcha_token' => 'test-proof'])->json('id');
    config(['queue.connections.database.table' => 'unavailable_notification_queue']);
    $this->actingAs(PlatformAdmin::factory()->active()->create(['handle' => 'sage.dev']), 'platform')->withSession(['platform.mfa' => true])
        ->postJson('/platform/applications/'.$id.'/approve')->assertStatus(500);
    expect(DB::table('platform_application_audits')->count())->toBe(0);
    expect(DB::connection('pgsql_migration')->table('churches')->count())->toBe(0);
    expect(ChurchApplication::findOrFail($id)->status->value)->toBe('pending');
});
