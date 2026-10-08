<?php

use App\Models\PlatformAdmin;
use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\ChurchScenario;
use Tests\Support\PostgresTestDatabase;

beforeEach(function (): void {
    PostgresTestDatabase::refresh();
});

it('discovers only the authenticated verified actor active workspaces without a tenant header', function (): void {
    [$owner, $church] = ChurchScenario::owner();
    ChurchScenario::owner();
    $response = $this->actingAs(User::findOrFail($owner->id), 'web')
        ->getJson('/auth/session?user_id=999&church=untrusted');

    $response->assertOk()->assertJsonCount(1, 'workspaces')
        ->assertJsonPath('id', $owner->id)
        ->assertJsonPath('workspaces.0.role', 'owner')
        ->assertHeader('Cache-Control', 'no-store, private');
    expect($response->json('workspaces.0.church_id') === $church->id)->toBeTrue();
    expect(array_keys($response->json('workspaces.0')))->toBe(['church_id', 'name', 'role']);
    expect(DB::table('church_memberships')->count())->toBe(0);
    expect(DB::table('churches')->count())->toBe(0);
});

it('discovers multiple teacher memberships in stable church id order and drops revoked or suspended access', function (): void {
    [, $first] = ChurchScenario::owner();
    [, $second] = ChurchScenario::owner();
    [$teacher, $membership] = ChurchScenario::teacher($first);
    DB::connection('pgsql_migration')->table('church_memberships')->insert([
        'id' => (string) Str::uuid(), 'church_id' => $second->id, 'user_id' => $teacher->id,
        'role' => 'teacher', 'status' => 'active', 'created_at' => now(), 'updated_at' => now(),
    ]);
    $this->actingAs(User::findOrFail($teacher->id), 'web');
    $rows = $this->getJson('/auth/session')->assertOk()->assertJsonCount(2, 'workspaces')->json('workspaces');
    $expected = [$first->id, $second->id];
    sort($expected);
    expect(array_column($rows, 'church_id') === $expected)->toBeTrue();
    expect(array_unique(array_column($rows, 'role')))->toBe(['teacher']);

    DB::connection('pgsql_migration')->table('church_memberships')->where('id', $membership->id)->update(['status' => 'revoked']);
    DB::connection('pgsql_migration')->table('churches')->where('id', $second->id)->update(['status' => 'suspended']);
    $this->getJson('/auth/session')->assertOk()->assertJsonPath('workspaces', []);
});

it('returns no workspace authority for an applicant or unverified actor', function (): void {
    $this->actingAs(User::factory()->create(), 'web')->getJson('/auth/session')
        ->assertOk()->assertJsonPath('workspaces', []);
    [$owner] = ChurchScenario::owner();
    $user = User::findOrFail($owner->id);
    $user->forceFill(['email_verified_at' => null])->save();
    $this->actingAs($user, 'web')->getJson('/auth/session')
        ->assertOk()->assertJsonPath('email_verified', false)->assertJsonPath('workspaces', []);
});

it('keeps discovery separate from operational MFA and cross tenant authorization', function (): void {
    [$owner, $church] = ChurchScenario::owner();
    [, $other] = ChurchScenario::owner();
    $this->actingAs(User::findOrFail($owner->id), 'web')->getJson('/auth/session')->assertOk();
    $this->getJson('/api/me', ['X-Church-Id' => $church->id])->assertForbidden();
    foreach (['/api/me', '/api/students', '/api/ministries', '/api/attendance-reports', '/api/imports/template', '/api/sync-conflicts', '/api/birthdays/today'] as $path) {
        $this->getJson($path, ['X-Church-Id' => $other->id])->assertForbidden();
    }
});

it('denies forged tenant requests for a Teacher whose own tenant preflight succeeds', function (): void {
    [, $church] = ChurchScenario::owner();
    [, $other] = ChurchScenario::owner();
    [$teacher] = ChurchScenario::teacher($church);
    $this->actingAs(User::findOrFail($teacher->id), 'web')
        ->getJson('/api/me', ['X-Church-Id' => $church->id])->assertOk();
    foreach (['/api/me', '/api/students', '/api/ministries', '/api/attendance-reports', '/api/imports/template', '/api/sync-conflicts', '/api/birthdays/today'] as $path) {
        $this->getJson($path, ['X-Church-Id' => $other->id])->assertForbidden();
    }
});

it('rejects missing and logged out church sessions and ignores platform guard authority', function (): void {
    $this->getJson('/auth/session')->assertUnauthorized();
    $user = User::factory()->create();
    $this->actingAs($user, 'web')->getJson('/auth/session')->assertOk();
    $this->postJson('/logout')->assertNoContent();
    $this->getJson('/auth/session')->assertUnauthorized();
    $this->actingAs(PlatformAdmin::factory()->create(['status' => 'active']), 'platform')
        ->getJson('/auth/session')->assertUnauthorized();
});

it('restricts the discovery capability while preserving forced tenant RLS', function (): void {
    $function = DB::selectOne("SELECT prosecdef, proconfig, EXISTS (SELECT 1 FROM aclexplode(proacl) WHERE grantee = 0 AND privilege_type = 'EXECUTE') AS public_execute FROM pg_proc WHERE proname = 'authenticated_church_workspaces'");
    expect($function)->not->toBeNull();
    expect($function->prosecdef)->toBeTrue();
    expect($function->public_execute)->toBeFalse();
    expect($function->proconfig)->toContain('search_path=pg_catalog');
    $tables = DB::select("SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN ('churches', 'church_memberships')");
    foreach ($tables as $table) {
        expect($table->relrowsecurity)->toBeTrue();
        expect($table->relforcerowsecurity)->toBeTrue();
    }
});

it('recreates the discovery function safely during isolated schema refresh', function (): void {
    expect(Artisan::call('migrate:fresh', ['--database' => 'pgsql_migration', '--force' => true]))->toBe(0);
    $this->actingAs(User::factory()->create(), 'web')->getJson('/auth/session')->assertOk()->assertJsonPath('workspaces', []);
});
