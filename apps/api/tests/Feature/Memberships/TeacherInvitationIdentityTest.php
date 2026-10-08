<?php

use App\Actions\Memberships\RecordMembershipAudit;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\Support\MembershipScenario;
use Tests\Support\PostgresTestDatabase;

beforeEach(function () {
    PostgresTestDatabase::refresh();
    Mail::fake();
    [$this->owner, $this->church, $this->ownerMembership] = MembershipScenario::owner($this);
    $this->ministry = MembershipScenario::ministry($this->church->id);
    $this->email = 'invited-teacher@example.test';
    $this->postJson('/api/teacher-invitations', ['email' => $this->email, 'ministry_ids' => [$this->ministry]])->assertCreated();
    $this->proof = MembershipScenario::proof();
    $this->body = $this->proof + ['email' => $this->email, 'name' => 'Invited Teacher', 'password' => Str::password(32)];
});

it('denies the signed in Owner without consuming the proof then permits signed out single use registration', function () {
    $this->postJson('/api/teacher-invitations/accept', $this->body)->assertForbidden()->assertJsonPath('code', 'forbidden');
    $db = DB::connection('pgsql_migration');
    expect(User::where('email', $this->email)->exists())->toBeFalse();
    expect($db->table('invitations')->value('accepted_at'))->toBeNull();
    expect($db->table('church_memberships')->count())->toBe(1);
    expect($db->table('audit_events')->where('action', 'invitation.accepted')->count())->toBe(0);
    expect($db->table('security_events')->where('action', 'access.denied')->where('actor_id', (string) $this->owner->id)->count())->toBe(1);
    $this->assertAuthenticatedAs($this->owner, 'web');
    $this->postJson('/logout')->assertNoContent();
    $this->postJson('/api/teacher-invitations/accept', $this->body)->assertOk();
    $teacher = User::where('email', $this->email)->firstOrFail();
    expect($teacher->hasVerifiedEmail())->toBeTrue();
    $this->assertGuest('web');
    $membership = $db->table('church_memberships')->where('user_id', $teacher->id)->first();
    expect($membership->church_id)->toBe($this->church->id);
    expect($membership->role)->toBe('teacher');
    expect($db->table('teacher_ministry_assignments')->where('membership_id', $membership->id)->value('ministry_id'))->toBe($this->ministry);
    $this->postJson('/api/teacher-invitations/accept', $this->body)->assertStatus(410);
    expect(User::where('email', $this->email)->count())->toBe(1);
    expect($db->table('church_memberships')->where('user_id', $teacher->id)->count())->toBe(1);
    expect($db->table('audit_events')->where('action', 'invitation.accepted')->count())->toBe(1);
    expect($db->table('church_memberships')->where('id', $this->ownerMembership->id)->value('role'))->toBe('owner');
});

it('keeps expired or altered proofs unavailable before identity checks or account creation', function (string $failure) {
    if ($failure === 'expired') {
        $this->travel(8)->days();
    } else {
        $this->body['token'] = str_repeat('0', 64);
    }
    $this->postJson('/api/teacher-invitations/accept', $this->body)->assertStatus(410);
    $this->postJson('/logout')->assertNoContent();
    $this->postJson('/api/teacher-invitations/accept', $this->body)->assertStatus(410);
    expect(User::where('email', $this->email)->exists())->toBeFalse();
    expect(DB::connection('pgsql_migration')->table('invitations')->value('accepted_at'))->toBeNull();
})->with(['expired', 'altered']);

it('rolls back a new account and all acceptance state if the required audit fails', function () {
    $this->postJson('/logout')->assertNoContent();
    $this->mock(RecordMembershipAudit::class)->shouldReceive('handle')->andThrow(new RuntimeException('unavailable'));
    $this->postJson('/api/teacher-invitations/accept', $this->body)->assertStatus(500);
    $db = DB::connection('pgsql_migration');
    expect(User::where('email', $this->email)->exists())->toBeFalse();
    expect($db->table('invitations')->value('accepted_at'))->toBeNull();
    expect($db->table('church_memberships')->count())->toBe(1);
    expect($db->table('teacher_ministry_assignments')->count())->toBe(0);
    expect($db->table('audit_events')->where('action', 'invitation.accepted')->count())->toBe(0);
});
