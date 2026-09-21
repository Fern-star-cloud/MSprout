<?php

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\Support\ChurchScenario;
use Tests\Support\MembershipScenario;
use Tests\Support\PostgresTestDatabase;

beforeEach(function () {
    PostgresTestDatabase::refresh();
    Mail::fake();
    [$this->owner, $this->church, $this->membership] = MembershipScenario::owner($this);
});

it('creates a normalized Teacher invitation without exposing its token and accepts it once', function () {
    $teacher = User::factory()->create();
    $ministry = MembershipScenario::ministry($this->church->id);
    $response = $this->postJson('/api/teacher-invitations', ['email' => ' '.strtoupper($teacher->email).' ', 'ministry_ids' => [$ministry]])->assertCreated();
    $response->assertJsonPath('status', 'pending')->assertJsonPath('role', 'teacher')->assertJsonMissingPath('token');
    $proof = MembershipScenario::proof();
    $row = DB::connection('pgsql_migration')->table('invitations')->first();
    expect($row->token_hash)->toBe(hash('sha256', $proof['token']))->not->toBe($proof['token']);
    expect($row->email)->toBe($teacher->email);
    $this->actingAs($teacher, 'web')->withSession(['password_hash_web' => $teacher->getAuthPassword()])->postJson('/api/teacher-invitations/accept', $proof + ['email' => $teacher->email])->assertOk();
    $this->getJson('/api/me')->assertJsonPath('assignments.ministry_ids.0', $ministry);
    $this->postJson('/api/teacher-invitations/accept', $proof + ['email' => $teacher->email])->assertStatus(410);
});

it('denies Teacher administration and scopes ministry visibility to active assignments', function () {
    [$teacher, $membership] = ChurchScenario::teacher($this->church);
    $teacher = User::findOrFail($teacher->id);
    $visible = MembershipScenario::ministry($this->church->id);
    $hidden = MembershipScenario::ministry($this->church->id);
    $this->putJson('/api/teachers/'.$membership->id.'/assignments', ['ministry_ids' => [$visible]])->assertOk();
    $this->actingAs($teacher, 'web')->withSession(['password_hash_web' => $teacher->getAuthPassword()]);
    $this->getJson('/api/teachers')->assertForbidden();
    $this->postJson('/api/teacher-invitations', ['email' => 'invite@example.test', 'ministry_ids' => [$visible]])->assertForbidden();
    $this->putJson('/api/teachers/'.$membership->id.'/assignments', ['ministry_ids' => [$hidden]])->assertForbidden();
    $this->deleteJson('/api/teachers/'.$membership->id)->assertForbidden();
    $this->postJson('/api/ownership-transfer', ['target_membership_id' => $membership->id, 'password' => 'invalid', 'code' => '123456'])->assertForbidden();
    $this->getJson('/api/assigned-ministries')->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $visible);
    $this->getJson('/api/assigned-ministries/'.$hidden)->assertNotFound();
});

it('rejects forged roles, duplicate assignments and cross church resources', function () {
    [, $other] = ChurchScenario::owner();
    [, $membership] = ChurchScenario::teacher($other);
    $foreign = MembershipScenario::ministry($other->id);
    $local = MembershipScenario::ministry($this->church->id);
    $this->postJson('/api/teacher-invitations', ['email' => 'invite@example.test', 'ministry_ids' => [$local], 'role' => 'owner'])->assertUnprocessable();
    $this->postJson('/api/teacher-invitations', ['email' => 'invite@example.test', 'ministry_ids' => [$foreign]])->assertUnprocessable();
    $this->postJson('/api/teacher-invitations', ['email' => 'invite@example.test', 'ministry_ids' => [$local, $local]])->assertUnprocessable();
    $this->putJson('/api/teachers/'.$membership->id.'/assignments', ['ministry_ids' => [$local]])->assertNotFound();
    $this->deleteJson('/api/teachers/'.$membership->id)->assertNotFound();
    Mail::assertNothingSent();
});

it('rejects altered expired revoked and cross email invitation proofs', function () {
    $teacher = User::factory()->create();
    $id = $this->postJson('/api/teacher-invitations', ['email' => $teacher->email, 'ministry_ids' => [MembershipScenario::ministry($this->church->id)]])->assertCreated()->json('id');
    $proof = MembershipScenario::proof();
    $this->actingAs($teacher, 'web')->withSession(['password_hash_web' => $teacher->getAuthPassword()]);
    foreach (['token' => Str::random(64), 'church_id' => (string) Str::uuid(), 'signature' => str_repeat('0', 64)] as $key => $value) {
        $this->postJson('/api/teacher-invitations/accept', array_replace($proof, [$key => $value, 'email' => $teacher->email]))->assertStatus(410);
    }
    $this->postJson('/api/teacher-invitations/accept', $proof + ['email' => 'unrelated@example.test'])->assertStatus(410);
    $other = User::factory()->create();
    $this->actingAs($other, 'web')->withSession(['password_hash_web' => $other->getAuthPassword()])->postJson('/api/teacher-invitations/accept', $proof + ['email' => $teacher->email])->assertStatus(410);
    $this->actingAs($this->owner, 'web')->withSession(['password_hash_web' => $this->owner->getAuthPassword()])->deleteJson('/api/teacher-invitations/'.$id)->assertNoContent();
    $this->getJson('/api/teacher-invitations')->assertJsonPath('data.0.status', 'revoked');
    $this->actingAs($teacher, 'web')->withSession(['password_hash_web' => $teacher->getAuthPassword()])->postJson('/api/teacher-invitations/accept', $proof + ['email' => $teacher->email])->assertStatus(410);
    $this->travel(8)->days();
    $this->postJson('/api/teacher-invitations/accept', $proof + ['email' => $teacher->email])->assertStatus(410);
});

it('revokes sessions assignments push subscriptions and offline leases without erasing audit', function () {
    [$teacher, $membership] = ChurchScenario::teacher($this->church);
    $this->putJson('/api/teachers/'.$membership->id.'/assignments', ['ministry_ids' => [MembershipScenario::ministry($this->church->id)]])->assertOk();
    MembershipScenario::deviceAccess($membership);
    $this->deleteJson('/api/teachers/'.$membership->id)->assertNoContent();
    $db = DB::connection('pgsql_migration');
    expect($db->table('sessions')->where('user_id', $teacher->id)->count())->toBe(0);
    foreach (['offline_authorizations', 'push_subscriptions'] as $table) {
        expect($db->table($table)->where('membership_id', $membership->id)->whereNull('revoked_at')->count())->toBe(0);
    }
    expect($db->table('membership_audits')->count())->toBe(2);
    $teacher = User::findOrFail($teacher->id);
    $this->actingAs($teacher, 'web')->withSession(['password_hash_web' => $teacher->getAuthPassword()])->getJson('/api/me')->assertForbidden();
});
