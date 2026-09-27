<?php

use App\Models\AuditEvent;
use App\Models\PlatformAdmin;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\Support\ChurchScenario;
use Tests\Support\MembershipScenario;
use Tests\Support\PostgresTestDatabase;

beforeEach(fn () => PostgresTestDatabase::refresh());

it('scopes Owner pages and omits all raw metadata with stable ordering', function () {
    [, $church] = MembershipScenario::owner($this);
    [, $other] = ChurchScenario::owner();
    foreach ([$church, $other] as $scope) {
        AuditEvent::factory()->count(3)->make(['category' => 'church', 'church_id' => $scope->id])->each(fn ($row) => DB::connection('pgsql_migration')->table('audit_events')->insert($row->getAttributes()));
    }
    $first = $this->getJson('/api/audit-events?per_page=2')->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('has_more', true);
    $second = $this->getJson('/api/audit-events?per_page=2&page=2')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('has_more', false);
    expect($first->json('data.0.id'))->not->toBe($second->json('data.0.id'));
    expect($this->getJson('/api/audit-events?per_page=2')->json('data'))->toBe($first->json('data'));
    expect($first->getContent())->not->toContain('metadata')->not->toContain($other->id);
    $this->withHeader('X-Church-Id', $other->id)->getJson('/api/audit-events')->assertForbidden();
});

it('rejects pagination abuse and metadata expansion', function (string $query) {
    MembershipScenario::owner($this);
    $this->getJson('/api/audit-events?'.$query)->assertUnprocessable();
})->with(['page=0', 'page=10001', 'page[]=1', 'per_page=0', 'per_page=101', 'per_page=1.5', 'include=metadata_json', 'church_id=anything']);

it('allows Teachers only their own permitted activity', function () {
    [, $church] = ChurchScenario::owner();
    [$teacher] = ChurchScenario::teacher($church);
    [$another] = ChurchScenario::teacher($church);
    $teacher = User::findOrFail($teacher->id);
    foreach ([$teacher, $another] as $actor) {
        foreach (['sync.accepted', 'submission.accepted', 'teacher.revoked'] as $action) {
            $row = AuditEvent::factory()->make(['category' => 'church', 'church_id' => $church->id, 'actor_type' => 'user', 'actor_id' => (string) $actor->id, 'action' => $action]);
            DB::connection('pgsql_migration')->table('audit_events')->insert($row->getAttributes());
        }
    }
    $this->actingAs($teacher, 'web')->withHeader('X-Church-Id', $church->id)->getJson('/api/audit-events')->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('scope', 'own');
    $this->getJson('/platform/audit-events')->assertUnauthorized();
});

it('isolates platform viewers and denies applicants missing MFA and guests', function () {
    $this->getJson('/api/audit-events')->assertUnauthorized();
    $this->actingAs(User::factory()->create(), 'web')->getJson('/api/audit-events')->assertForbidden();
    $this->getJson('/platform/audit-events')->assertUnauthorized();
    AuditEvent::factory()->create();
    $this->actingAs(PlatformAdmin::factory()->active()->create(['handle' => 'sage.dev']), 'platform')->getJson('/platform/audit-events')->assertForbidden();
    $this->withSession(['platform.mfa' => true])->getJson('/platform/audit-events')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('scope', 'platform');
});
