<?php

use App\Actions\Applications\RecordApplicationDecision;
use App\Mail\ChurchApplicationDecisionMail;
use App\Models\ChurchApplication;
use App\Models\PlatformAdmin;
use App\Models\User;
use App\Support\Captcha\CaptchaVerifier;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\Support\PostgresTestDatabase;

beforeEach(function () {
    PostgresTestDatabase::refresh();
    Mail::fake();
    Http::preventStrayRequests();
    $this->mock(CaptchaVerifier::class)->shouldReceive('verify')->andReturn(true)->byDefault();
});

it('returns only the current users application and normalizes bounded input', function () {
    $user = User::factory()->create();
    $this->actingAs($user, 'web')->getJson('/api/church-applications/current')->assertExactJson(['application' => null]);
    $response = $this->postJson('/api/church-applications', applicationInput(['church_name' => "  Grace\u{00a0}  Church  ", 'city' => ' Davao   City ']))->assertCreated();
    $response->assertJsonPath('church_name', 'Grace Church')->assertJsonPath('city', 'Davao City')->assertJsonMissingPath('user_id')->assertJsonMissingPath('captcha_token');
    $this->getJson('/api/church-applications/current')->assertJsonPath('application.id', $response->json('id'));
    $this->actingAs(User::factory()->create(), 'web')->getJson('/api/church-applications/current')->assertExactJson(['application' => null]);
});

it('requires verified church authentication and rejects invalid fields and uploads', function () {
    $this->postJson('/api/church-applications', applicationInput())->assertUnauthorized();
    $this->actingAs(User::factory()->unverified()->create(), 'web')->postJson('/api/church-applications', applicationInput())->assertForbidden();
    $this->getJson('/api/church-applications/current')->assertForbidden();
    $this->actingAs(User::factory()->create(), 'web');
    foreach (['timezone' => 'GMT+8', 'church_name' => str_repeat('a', 161), 'city' => str_repeat('b', 121), 'address' => str_repeat('c', 241)] as $field => $value) {
        $this->postJson('/api/church-applications', applicationInput([$field => $value]))->assertUnprocessable();
    }
    $this->withHeader('Accept', 'application/json')->post('/api/church-applications', applicationInput(['attachment' => UploadedFile::fake()->create('document.pdf', 1)]))->assertUnprocessable();
});

it('rejects unrecognized decision fields and forged ownership input', function () {
    $this->actingAs(User::factory()->create(), 'web');
    $this->postJson('/api/church-applications', applicationInput(['user_id' => 999]))->assertUnprocessable();
    $id = $this->postJson('/api/church-applications', applicationInput())->assertCreated()->json('id');
    $this->actingAs(PlatformAdmin::factory()->active()->create(['handle' => 'sage.dev']), 'platform')->withSession(['platform.mfa' => true]);
    $this->postJson('/platform/applications/'.$id.'/reject', ['category' => 'other', 'reason' => 'Not eligible', 'user_id' => 999])->assertUnprocessable();
    $this->postJson('/platform/applications/'.$id.'/approve', ['church_id' => (string) Str::uuid()])->assertUnprocessable();
    expect(ChurchApplication::findOrFail($id)->status->value)->toBe('pending');
});

it('paginates review metadata and excludes purged applications', function () {
    foreach (range(1, 21) as $number) {
        ChurchApplication::create(['user_id' => User::factory()->create()->id, 'church_name' => 'Church '.$number, 'status' => 'pending']);
    }
    $purged = ChurchApplication::create(['status' => 'rejected', 'purged_at' => now()]);
    $this->actingAs(PlatformAdmin::factory()->active()->create(['handle' => 'sage.dev']), 'platform')->withSession(['platform.mfa' => true]);
    $this->getJson('/platform/applications')->assertOk()->assertJsonCount(20, 'data')->assertJsonPath('has_more', true);
    $this->getJson('/platform/applications?page=2')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('has_more', false);
    $this->getJson('/platform/applications?status=rejected')->assertJsonCount(0, 'data');
    $this->getJson('/platform/applications/'.$purged->id)->assertNotFound();
    $this->getJson('/platform/applications?page=0')->assertUnprocessable();
});

it('rejects invalid captcha and limits submission attempts', function () {
    $this->mock(CaptchaVerifier::class)->shouldReceive('verify')->andReturn(false);
    $this->actingAs(User::factory()->create(), 'web');
    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/api/church-applications', applicationInput())->assertUnprocessable()->assertJsonStructure(['field_errors' => ['captcha_token']]);
    }
    $this->postJson('/api/church-applications', applicationInput())->assertStatus(429);
    expect(ChurchApplication::count())->toBe(0);
});

it('detects active duplicates by applicant and normalized church and city', function () {
    $this->actingAs(User::factory()->create(), 'web')->postJson('/api/church-applications', applicationInput())->assertCreated();
    $this->postJson('/api/church-applications', applicationInput(['church_name' => 'Different']))->assertConflict();
    $this->actingAs(User::factory()->create(), 'web')->postJson('/api/church-applications', applicationInput(['church_name' => ' GRACE   CHURCH ', 'city' => ' DAVAO CITY ']))->assertConflict();
});

it('requires isolated active sage dev MFA for every review endpoint', function () {
    $user = User::factory()->create();
    $id = $this->actingAs($user, 'web')->postJson('/api/church-applications', applicationInput())->json('id');
    foreach (['/platform/applications', '/platform/applications/'.$id] as $url) {
        $this->getJson($url)->assertUnauthorized();
    }
    foreach (['approve', 'reject'] as $decision) {
        $this->postJson('/platform/applications/'.$id.'/'.$decision, ['category' => 'other', 'reason' => 'Not eligible'])->assertUnauthorized();
    }
    $admin = PlatformAdmin::factory()->active()->create(['handle' => 'sage.dev']);
    $this->actingAs($admin, 'platform')->getJson('/platform/applications')->assertForbidden();
    $this->withSession(['platform.mfa' => true])->getJson('/platform/applications')->assertOk()->assertJsonCount(1, 'data');
    $this->getJson('/platform/applications/'.$id)->assertOk()->assertJsonMissingPath('email')->assertJsonMissingPath('user_id');
    $admin->forceFill(['status' => 'disabled'])->save();
    $this->getJson('/platform/applications')->assertForbidden();
    $admin->forceFill(['status' => 'active', 'handle' => 'other.admin'])->save();
    $this->getJson('/platform/applications/'.$id)->assertForbidden();
});

it('makes approval atomic idempotent audited and MFA gated', function () {
    $user = User::factory()->create();
    $id = $this->actingAs($user, 'web')->postJson('/api/church-applications', applicationInput())->json('id');
    $admin = PlatformAdmin::factory()->active()->create(['handle' => 'sage.dev']);
    $correlation = (string) Str::uuid();
    $this->actingAs($admin, 'platform')->withSession(['platform.mfa' => true])->withHeader('X-Correlation-Id', $correlation);
    $first = $this->postJson('/platform/applications/'.$id.'/approve')->assertOk()->assertHeader('X-Correlation-Id', $correlation)->json();
    $this->postJson('/platform/applications/'.$id.'/approve')->assertExactJson($first);
    $this->postJson('/platform/applications/'.$id.'/reject', ['category' => 'other', 'reason' => 'Changed mind'])->assertConflict();
    expect(DB::connection('pgsql_migration')->table('churches')->count())->toBe(1);
    expect(DB::connection('pgsql_migration')->table('church_memberships')->count())->toBe(1);
    expect(DB::table('platform_application_audits')->where('correlation_id', $correlation)->count())->toBe(1);
    Mail::assertQueued(ChurchApplicationDecisionMail::class, 1);
    $this->actingAs($user, 'web')->withHeader('X-Church-Id', $first['church_id'])->getJson('/api/me')->assertForbidden();
    expect(DB::table('churches')->count())->toBe(0); // RLS context did not leak.
});

it('rejects with a sanitized reason and preserves the original decision on replay', function () {
    $this->actingAs(User::factory()->create(), 'web');
    $id = $this->postJson('/api/church-applications', applicationInput())->json('id');
    $admin = PlatformAdmin::factory()->active()->create(['handle' => 'sage.dev']);
    $this->actingAs($admin, 'platform')->withSession(['platform.mfa' => true]);
    $this->postJson('/platform/applications/'.$id.'/reject', ['category' => 'invalid', 'reason' => ''])->assertUnprocessable();
    $first = $this->postJson('/platform/applications/'.$id.'/reject', ['category' => 'duplicate', 'reason' => " <b>Already</b>   registered\n"])->assertOk()->assertJsonPath('reason', 'Already registered')->json();
    $this->postJson('/platform/applications/'.$id.'/reject', ['category' => 'other', 'reason' => 'Another reason'])->assertExactJson($first);
    $this->postJson('/platform/applications/'.$id.'/approve')->assertConflict();
    Mail::assertQueued(ChurchApplicationDecisionMail::class, 1);
    expect(DB::table('platform_application_audits')->count())->toBe(1);
    expect(json_encode(DB::table('platform_application_audits')->first()))->not->toContain('Already registered')->not->toContain('Grace Church');
});

it('rolls back approval and notification when required audit persistence fails', function () {
    $this->actingAs(User::factory()->create(), 'web');
    $id = $this->postJson('/api/church-applications', applicationInput())->json('id');
    $this->mock(RecordApplicationDecision::class)->shouldReceive('handle')->andThrow(new RuntimeException('Audit unavailable'));
    $this->actingAs(PlatformAdmin::factory()->active()->create(['handle' => 'sage.dev']), 'platform')->withSession(['platform.mfa' => true]);
    $this->postJson('/platform/applications/'.$id.'/approve')->assertStatus(500);
    expect(ChurchApplication::findOrFail($id)->status->value)->toBe('pending');
    expect(DB::connection('pgsql_migration')->table('churches')->count())->toBe(0);
    Mail::assertNothingQueued();
});

function applicationInput(array $overrides = []): array
{
    return array_replace(['church_name' => 'Grace Church', 'timezone' => 'Asia/Manila', 'city' => 'Davao City', 'captcha_token' => 'test-proof'], $overrides);
}

it('keeps an applicant tenantless until sage.dev approves', function () {
    $applicant = User::factory()->create();
    $response = $this->actingAs($applicant, 'web')->postJson('/api/church-applications', [
        'church_name' => 'Grace Kids Ministry', 'timezone' => 'Asia/Manila',
        'city' => 'Davao City', 'captcha_token' => 'test-proof',
    ])->assertCreated();

    expect(DB::connection('pgsql_migration')->table('church_memberships')->where('user_id', $applicant->id)->count())->toBe(0);
    $admin = PlatformAdmin::factory()->active()->create(['handle' => 'sage.dev']);
    $this->actingAs($admin, 'platform')->withSession(['platform.mfa' => true])
        ->postJson('/platform/applications/'.$response->json('id').'/approve')->assertOk();

    expect(DB::connection('pgsql_migration')->table('church_memberships')->where('user_id', $applicant->id)->where('role', 'owner')->count())->toBe(1);
});
