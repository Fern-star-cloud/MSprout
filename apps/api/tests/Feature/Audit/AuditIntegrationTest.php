<?php

use App\Domain\Audit\AuditWriter;
use App\Domain\Audit\SecurityEventWriter;
use App\Http\Middleware\AuditAuthentication;
use App\Http\Middleware\CorrelationId;
use App\Models\ChurchApplication;
use App\Models\PlatformAdmin;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use PragmaRX\Google2FA\Google2FA;
use Tests\Support\ChurchScenario;
use Tests\Support\MembershipScenario;
use Tests\Support\PostgresTestDatabase;

beforeEach(function () {
    PostgresTestDatabase::refresh();
    Mail::fake();
    Notification::fake();
});

it('rolls back every membership action when the canonical writer fails', function (string $action) {
    [$owner, $church] = MembershipScenario::owner($this);
    [$teacher, $membership] = ChurchScenario::teacher($church);
    $ministry = MembershipScenario::ministry($church->id);
    $invitee = User::factory()->create();
    $id = $this->postJson('/api/teacher-invitations', ['email' => $invitee->email, 'ministry_ids' => [$ministry]])->assertCreated()->json('id');
    $proof = MembershipScenario::proof();
    MembershipScenario::deviceAccess($membership);
    $db = DB::connection('pgsql_migration');
    $tables = ['church_memberships', 'invitations', 'teacher_ministry_assignments', 'offline_authorizations', 'push_subscriptions', 'sessions', 'audit_events'];
    $before = [];
    foreach ($tables as $table) {
        $before[$table] = json_encode($db->table($table)->orderBy('id')->get());
    }
    $this->mock(AuditWriter::class)->shouldReceive('record')->andThrow(new RuntimeException('private-marker'));
    match ($action) {
        'invite' => $this->postJson('/api/teacher-invitations', ['email' => $invitee->email, 'ministry_ids' => [$ministry]])->assertStatus(500),
        'accept' => $this->actingAs($invitee, 'web')->withSession(['password_hash_web' => $invitee->password])->postJson('/api/teacher-invitations/accept', $proof + ['email' => $invitee->email])->assertStatus(500),
        'revoke-invitation' => $this->deleteJson('/api/teacher-invitations/'.$id)->assertStatus(500),
        'assign' => $this->putJson('/api/teachers/'.$membership->id.'/assignments', ['ministry_ids' => [$ministry]])->assertStatus(500),
        'revoke' => $this->deleteJson('/api/teachers/'.$membership->id)->assertStatus(500),
        'transfer' => $this->postJson('/api/ownership-transfer', ['target_membership_id' => $membership->id, 'password' => $this->password, 'code' => (new Google2FA)->getCurrentOtp($this->secret)])->assertStatus(500),
    };
    foreach ($tables as $table) {
        expect(json_encode($db->table($table)->orderBy('id')->get()))->toBe($before[$table]);
    }
})->with(['invite', 'accept', 'revoke-invitation', 'assign', 'revoke', 'transfer']);

it('rolls back application decisions when the canonical writer fails', function (string $decision) {
    $user = User::factory()->create();
    $application = ChurchApplication::create(['user_id' => $user->id, 'church_name' => 'Test', 'city' => 'Test', 'timezone' => 'Asia/Manila', 'status' => 'pending', 'duplicate_key' => hash('sha256', Str::random())]);
    $this->mock(AuditWriter::class)->shouldReceive('record')->andThrow(new RuntimeException('private-marker'));
    $this->actingAs(PlatformAdmin::factory()->active()->create(['handle' => 'sage.dev']), 'platform')->withSession(['platform.mfa' => true])
        ->postJson('/platform/applications/'.$application->id.'/'.$decision, $decision === 'approve' ? [] : ['category' => 'other', 'reason' => 'Test decision'])->assertStatus(500);
    expect($application->fresh()->status->value)->toBe('pending');
    expect(DB::connection('pgsql_migration')->table('churches')->count())->toBe(0);
    expect(DB::table('jobs')->count())->toBe(0);
})->with(['approve', 'reject']);

it('rolls back MFA enrollment confirmation disable and recovery regeneration when security persistence fails', function (string $operation) {
    $user = User::factory()->create();
    $secret = (new Google2FA)->generateSecretKey();
    if ($operation !== 'enroll') {
        $user->forceFill(['two_factor_secret' => encrypt($secret), 'two_factor_recovery_codes' => encrypt(json_encode(['test-recovery'])), 'two_factor_confirmed_at' => $operation === 'confirm' ? null : now()])->save();
    }
    $before = hash('sha256', json_encode($user->fresh()->getAttributes()));
    $this->actingAs($user, 'web')->withSession(['auth.password_confirmed_at' => time()]);
    $this->mock(SecurityEventWriter::class)->shouldReceive('record')->andThrow(new RuntimeException('private-marker'));
    match ($operation) {
        'enroll' => $this->postJson('/user/two-factor-authentication')->assertStatus(500),
        'confirm' => $this->postJson('/user/confirmed-two-factor-authentication', ['code' => (new Google2FA)->getCurrentOtp($secret)])->assertStatus(500),
        'disable' => $this->deleteJson('/user/two-factor-authentication')->assertStatus(500),
        'regenerate' => $this->postJson('/user/two-factor-recovery-codes')->assertStatus(500),
    };
    expect(hash('sha256', json_encode($user->fresh()->getAttributes())))->toBe($before);
})->with(['enroll', 'confirm', 'disable', 'regenerate']);

it('rolls back password reset including the one use proof on audit failure', function () {
    $user = User::factory()->create();
    $this->postJson('/forgot-password', ['email' => $user->email])->assertOk();
    $token = Notification::sent($user, ResetPassword::class)->first()->token;
    $password = Str::password(32);
    $before = $user->password;
    $this->mock(SecurityEventWriter::class)->shouldReceive('record')->andThrow(new RuntimeException('private-marker'));
    $this->postJson('/reset-password', ['email' => $user->email, 'token' => $token, 'password' => $password, 'password_confirmation' => $password])->assertStatus(500);
    expect($user->fresh()->password)->toBe($before);
    expect(DB::table('password_reset_tokens')->count())->toBe(1);
});

it('rolls back platform setup and never establishes a session on audit failure', function () {
    $admin = PlatformAdmin::factory()->create();
    $url = URL::temporarySignedRoute('platform.setup.show', now()->addMinutes(20), ['platformAdmin' => $admin->id]);
    $this->mock(SecurityEventWriter::class)->shouldReceive('record')->andThrow(new RuntimeException('private-marker'));
    $password = Str::password(32);
    $this->postJson($url, ['password' => $password, 'password_confirmation' => $password])->assertStatus(500);
    expect($admin->fresh()->password)->toBeNull();
    $this->assertGuest('platform');
});

it('propagates request correlation into queued payloads audit and security records', function () {
    $id = (string) Str::uuid();
    $this->withHeader('X-Correlation-Id', $id)->postJson('/login', ['email' => 'missing@example.test', 'password' => Str::password(32)])->assertUnprocessable();
    expect(DB::table('security_events')->where('correlation_id', $id)->where('result', 'failure')->count())->toBe(1);
    $this->withHeader('X-Correlation-Id', $id)->getJson('/api/me')->assertUnauthorized();
    expect(DB::table('security_events')->where('correlation_id', $id)->where('action', 'access.denied')->count())->toBe(1);
});

it('attributes generic access denial to an authenticated actor', function () {
    $user = User::factory()->create();
    $id = (string) Str::uuid();

    $this->actingAs($user, 'web')->withHeader('X-Correlation-Id', $id)
        ->getJson('/api/audit-events')->assertForbidden();

    $event = DB::table('security_events')->where('correlation_id', $id)->sole();
    expect($event->action)->toBe('access.denied')
        ->and($event->actor_type)->toBe('user')
        ->and($event->actor_id)->toBe((string) $user->id);
});

it('does not duplicate a generic denial already classified by authentication auditing', function () {
    $id = (string) Str::uuid();
    $request = Request::create('/login', 'POST', server: ['HTTP_X_CORRELATION_ID' => $id]);
    $request->setLaravelSession(app('session')->driver());

    $response = (new CorrelationId)->handle(
        $request,
        fn (Request $request) => (new AuditAuthentication)->handle($request, fn () => response()->json([], 403)),
    );

    expect($response->getStatusCode())->toBe(403);
    expect(DB::table('security_events')->where('correlation_id', $id)->count())->toBe(1)
        ->and(DB::table('security_events')->where('correlation_id', $id)->value('action'))->toBe('auth.login');
});

it('preserves denial responses if optional failure telemetry is unavailable', function () {
    $this->mock(SecurityEventWriter::class)->shouldReceive('record')->andThrow(new RuntimeException('private-marker'));
    $this->getJson('/api/me')->assertUnauthorized();
    $this->postJson('/login', ['email' => 'missing@example.test', 'password' => Str::password(32)])->assertUnprocessable();
});
