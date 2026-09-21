<?php

use App\Actions\Memberships\RecordMembershipAudit;
use App\Mail\TeacherInvitationMail;
use App\Models\PlatformAdmin;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use Illuminate\Contracts\Mail\Mailer;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\Support\ChurchScenario;
use Tests\Support\MembershipScenario;
use Tests\Support\PostgresTestDatabase;

beforeEach(function () {
    PostgresTestDatabase::refresh();
    Mail::fake();
    [$this->owner, $this->church] = MembershipScenario::owner($this);
});

it('removes all assignments and invalidates existing authorizations', function () {
    [, $teacher] = ChurchScenario::teacher($this->church);
    $id = MembershipScenario::ministry($this->church->id);
    $this->putJson('/api/teachers/'.$teacher->id.'/assignments', ['ministry_ids' => [$id]])->assertOk();
    MembershipScenario::deviceAccess($teacher);
    $this->putJson('/api/teachers/'.$teacher->id.'/assignments', ['ministry_ids' => []])->assertOk();
    expect(DB::connection('pgsql_migration')->table('teacher_ministry_assignments')->whereNull('revoked_at')->count())->toBe(0);
    expect(DB::connection('pgsql_migration')->table('offline_authorizations')->whereNull('revoked_at')->count())->toBe(0);
});

it('rolls back assignment and invitation revocation when audit fails', function () {
    [, $teacher] = ChurchScenario::teacher($this->church);
    $ministry = MembershipScenario::ministry($this->church->id);
    $id = $this->postJson('/api/teacher-invitations', ['email' => 'invited@example.test', 'ministry_ids' => [$ministry]])->assertCreated()->json('id');
    $this->mock(RecordMembershipAudit::class)->shouldReceive('handle')->andThrow(new RuntimeException('private failure marker'));
    Log::spy();
    $this->putJson('/api/teachers/'.$teacher->id.'/assignments', ['ministry_ids' => [$ministry]])->assertStatus(500);
    $this->deleteJson('/api/teacher-invitations/'.$id)->assertStatus(500);
    expect(DB::connection('pgsql_migration')->table('teacher_ministry_assignments')->count())->toBe(0);
    expect(DB::connection('pgsql_migration')->table('invitations')->value('revoked_at'))->toBeNull();
    Log::shouldHaveReceived('error')->withArgs(fn ($message, $context) => ! str_contains($message, 'private') && array_keys($context) === ['correlation_id'])->twice();
});

it('requires active church status for all membership reads', function () {
    DB::connection('pgsql_migration')->table('churches')->where('id', $this->church->id)->update(['status' => 'suspended']);
    $this->getJson('/api/teachers')->assertForbidden();
    $this->getJson('/api/assigned-ministries')->assertForbidden();
});

it('creates an account only from a valid email bound invitation and never replaces an existing password', function () {
    $email = 'new-invitee@example.test';
    $password = Str::password(32);
    $this->postJson('/api/teacher-invitations', ['email' => $email, 'ministry_ids' => [MembershipScenario::ministry($this->church->id)]])->assertCreated();
    $proof = MembershipScenario::proof();
    $this->postJson('/logout')->assertNoContent();
    $this->postJson('/api/teacher-invitations/accept', $proof + ['email' => $email, 'name' => 'New Teacher', 'password' => $password])->assertOk();
    $created = User::where('email', $email)->firstOrFail();
    expect($created->hasVerifiedEmail())->toBeTrue();
    $this->postJson('/api/teacher-invitations/accept', $proof + ['email' => $email, 'name' => 'New Teacher', 'password' => Str::password(32)])->assertStatus(410);
    expect(User::findOrFail($created->id)->password)->toBe($created->password);
});

it('supersedes duplicate pending invitations without revealing account existence', function () {
    $ministry = MembershipScenario::ministry($this->church->id);
    $teacher = User::factory()->create();
    $body = ['email' => $teacher->email, 'ministry_ids' => [$ministry]];
    $first = $this->postJson('/api/teacher-invitations', $body)->assertCreated();
    $old = MembershipScenario::proof();
    $this->postJson('/api/teacher-invitations', $body)->assertCreated();
    $new = MembershipScenario::proof();
    expect(DB::connection('pgsql_migration')->table('invitations')->where('id', $first->json('id'))->value('revoked_at'))->not->toBeNull();
    $this->postJson('/api/teacher-invitations', ['email' => 'unknown@example.test', 'ministry_ids' => [$ministry]])->assertCreated()->assertJsonStructure(array_keys($first->json()));
    $this->actingAs($teacher, 'web')->withSession(['password_hash_web' => $teacher->password]);
    $this->postJson('/api/teacher-invitations/accept', $old + ['email' => $teacher->email])->assertStatus(410);
    $this->travel(8)->days();
    $this->postJson('/api/teacher-invitations/accept', $new + ['email' => $teacher->email])->assertStatus(410);
});

it('rejects unverified users cross church headers and real CSRF failures', function () {
    $teacher = User::factory()->unverified()->create();
    $this->postJson('/api/teacher-invitations', ['email' => $teacher->email, 'ministry_ids' => [MembershipScenario::ministry($this->church->id)]])->assertCreated();
    $proof = MembershipScenario::proof();
    $this->actingAs($teacher, 'web')->withSession(['password_hash_web' => $teacher->password]);
    $this->postJson('/api/teacher-invitations/accept', $proof + ['email' => $teacher->email])->assertStatus(410);
    $teacher->markEmailAsVerified();
    $this->withHeader('X-Church-Id', (string) Str::uuid())->postJson('/api/teacher-invitations/accept', $proof + ['email' => $teacher->email])->assertStatus(410);
    $this->app->instance('env', 'local');
    $this->postJson('/api/teacher-invitations/accept', $proof + ['email' => $teacher->email])->assertStatus(419);
});

it('rolls back invitation acceptance and revocation if audit persistence fails', function () {
    $teacher = User::factory()->create();
    $this->postJson('/api/teacher-invitations', ['email' => $teacher->email, 'ministry_ids' => [MembershipScenario::ministry($this->church->id)]])->assertCreated();
    $proof = MembershipScenario::proof();
    $this->mock(RecordMembershipAudit::class)->shouldReceive('handle')->andThrow(new RuntimeException('unavailable'));
    $this->actingAs($teacher, 'web')->withSession(['password_hash_web' => $teacher->password])->postJson('/api/teacher-invitations/accept', $proof + ['email' => $teacher->email])->assertStatus(500);
    expect(DB::connection('pgsql_migration')->table('invitations')->value('accepted_at'))->toBeNull();
    expect(DB::connection('pgsql_migration')->table('church_memberships')->where('user_id', $teacher->id)->count())->toBe(0);
    [, $member] = ChurchScenario::teacher($this->church);
    MembershipScenario::deviceAccess($member);
    $this->actingAs($this->owner, 'web')->withSession(['password_hash_web' => $this->owner->password])->deleteJson('/api/teachers/'.$member->id)->assertStatus(500);
    expect(DB::connection('pgsql_migration')->table('church_memberships')->where('id', $member->id)->value('status'))->toBe('active');
    expect(DB::connection('pgsql_migration')->table('offline_authorizations')->whereNull('revoked_at')->count())->toBe(1);
});

it('keeps every new tenant table under forced RLS and audits append only', function () {
    [, $other] = ChurchScenario::owner();
    $foreign = MembershipScenario::ministry($other->id);
    $this->postJson('/api/teacher-invitations', ['email' => 'invited@example.test', 'ministry_ids' => [MembershipScenario::ministry($this->church->id)]])->assertCreated();
    foreach (['ministries', 'invitations', 'invitation_ministries', 'teacher_ministry_assignments', 'offline_authorizations', 'push_subscriptions', 'membership_audits'] as $table) {
        expect(DB::table($table)->count())->toBe(0);
        $flags = DB::selectOne('SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = ?', [$table]);
        expect($flags->relrowsecurity)->toBeTrue()->and($flags->relforcerowsecurity)->toBeTrue();
    }
    app(TenantContext::class)->run($this->church->id, function () use ($other, $foreign) {
        expect(DB::table('ministries')->where('id', $foreign)->count())->toBe(0);
        expect(DB::table('ministries')->where('id', $foreign)->update(['name' => 'Forbidden']))->toBe(0);
        expect(DB::table('ministries')->where('id', $foreign)->delete())->toBe(0);
        expect(fn () => DB::transaction(fn () => DB::table('ministries')->insert(['id' => (string) Str::uuid(), 'church_id' => $other->id, 'name' => 'Forbidden'])))->toThrow(QueryException::class);
        expect(fn () => DB::transaction(fn () => DB::table('membership_audits')->update(['action' => 'changed'])))->toThrow(QueryException::class);
        expect(fn () => DB::transaction(fn () => DB::table('membership_audits')->delete()))->toThrow(QueryException::class);
    });
});

it('does not persist raw invitation proof or leak mail transport failures', function () {
    $this->postJson('/api/teacher-invitations', ['email' => 'invited@example.test', 'ministry_ids' => [MembershipScenario::ministry($this->church->id)]])->assertCreated();
    $proof = MembershipScenario::proof();
    $db = DB::connection('pgsql_migration');
    expect(json_encode($db->table('invitations')->get()))->not->toContain($proof['token'])->not->toContain($proof['signature']);
    expect($db->table('jobs')->count())->toBe(0);
    expect((new TeacherInvitationMail($proof))->content()->with['link'])->toContain('/account/teacher-invitation#')->not->toContain('?');
    $mailer = Mockery::mock(Mailer::class);
    $mailer->shouldReceive('send')->andThrow(new RuntimeException('private@example.test'));
    try {
        (new TeacherInvitationMail($proof))->send($mailer);
        $this->fail('Expected failure');
    } catch (RuntimeException $error) {
        expect($error->getMessage())->toBe('Teacher invitation delivery failed.');
        expect($error->getPrevious())->toBeNull();
    }
});

it('blocks cross tenant writes and foreign parent assignments at the database layer', function () {
    [, $other] = ChurchScenario::owner();
    [, $member] = ChurchScenario::teacher($this->church);
    $ministry = MembershipScenario::ministry($this->church->id);
    $foreignMinistry = MembershipScenario::ministry($other->id);
    $this->putJson('/api/teachers/'.$member->id.'/assignments', ['ministry_ids' => [$ministry]])->assertOk();
    MembershipScenario::deviceAccess($member);
    $this->postJson('/api/teacher-invitations', ['email' => 'invited@example.test', 'ministry_ids' => [$ministry]])->assertCreated();
    app(TenantContext::class)->run($this->church->id, function () use ($other, $foreignMinistry) {
        foreach (['ministries', 'invitations', 'invitation_ministries', 'teacher_ministry_assignments', 'offline_authorizations', 'push_subscriptions', 'membership_audits'] as $table) {
            $row = (array) DB::table($table)->first();
            expect($row)->not->toBeEmpty();
            $row['id'] = (string) Str::uuid();
            $row['church_id'] = $other->id;
            expect(fn () => DB::transaction(fn () => DB::table($table)->insert($row)))->toThrow(QueryException::class);
        }
        expect(fn () => DB::transaction(fn () => DB::table('teacher_ministry_assignments')->update(['ministry_id' => $foreignMinistry])))->toThrow(QueryException::class);
        $row = (array) DB::table('teacher_ministry_assignments')->first();
        $row['id'] = (string) Str::uuid();
        expect(fn () => DB::transaction(fn () => DB::table('teacher_ministry_assignments')->insert($row)))->toThrow(QueryException::class);
    });
});

it('blocks platform identities and Owner sessions without current MFA', function () {
    $this->withSession(['church_mfa_user_id' => null])->getJson('/api/teachers')->assertForbidden();
    $this->postJson('/logout')->assertNoContent();
    $this->actingAs(PlatformAdmin::factory()->active()->create(), 'platform')->getJson('/api/teachers')->assertUnauthorized();
});

it('rejects aliased and failover logging mail transports before generating invitations', function () {
    $ministry = MembershipScenario::ministry($this->church->id);
    config(['mail.default' => 'unsafe', 'mail.mailers.unsafe' => ['transport' => 'log']]);
    $this->postJson('/api/teacher-invitations', ['email' => 'private@example.test', 'ministry_ids' => [$ministry]])->assertStatus(503);
    config(['mail.default' => 'failover']);
    $this->postJson('/api/teacher-invitations', ['email' => 'private@example.test', 'ministry_ids' => [$ministry]])->assertStatus(503);
    Mail::assertNothingSent();
    expect(DB::connection('pgsql_migration')->table('invitations')->count())->toBe(0);
});

it('normalizes the acceptance email and rechecks verified identity under lock', function () {
    $teacher = User::factory()->create();
    $this->postJson('/api/teacher-invitations', ['email' => $teacher->email, 'ministry_ids' => [MembershipScenario::ministry($this->church->id)]])->assertCreated();
    $proof = MembershipScenario::proof();
    $this->actingAs($teacher, 'web')->withSession(['password_hash_web' => $teacher->password]);
    // A concurrent account update must not leave the earlier in-memory identity trusted.
    User::whereKey($teacher->id)->update(['email_verified_at' => null]);
    $this->postJson('/api/teacher-invitations/accept', $proof + ['email' => $teacher->email])->assertStatus(410);
    User::whereKey($teacher->id)->update(['email_verified_at' => now()]);
    $this->postJson('/api/teacher-invitations/accept', $proof + ['email' => ' '.strtoupper($teacher->email).' '])->assertOk();
});

it('keeps an existing account password unchanged on unauthenticated acceptance', function () {
    $teacher = User::factory()->create();
    $this->postJson('/api/teacher-invitations', ['email' => $teacher->email, 'ministry_ids' => [MembershipScenario::ministry($this->church->id)]])->assertCreated();
    $proof = MembershipScenario::proof();
    $this->postJson('/logout')->assertNoContent();
    $this->postJson('/api/teacher-invitations/accept', $proof + ['email' => $teacher->email, 'name' => 'Other name', 'password' => Str::password(32)])->assertUnprocessable();
    expect(User::findOrFail($teacher->id)->password)->toBe($teacher->password);
    expect(DB::connection('pgsql_migration')->table('invitations')->value('accepted_at'))->toBeNull();
});

it('rolls back invitation and audit if mail cannot be delivered', function () {
    $ministry = MembershipScenario::ministry($this->church->id);
    Mail::shouldReceive('to')->andReturnSelf();
    Mail::shouldReceive('send')->andThrow(new RuntimeException('delivery unavailable'));
    $this->postJson('/api/teacher-invitations', ['email' => 'invited@example.test', 'ministry_ids' => [$ministry]])->assertStatus(500);
    expect(DB::connection('pgsql_migration')->table('invitations')->count())->toBe(0);
    expect(DB::connection('pgsql_migration')->table('membership_audits')->count())->toBe(0);
});
