<?php

use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\Support\ChurchScenario;
use Tests\Support\MembershipScenario;
use Tests\Support\PostgresTestDatabase;

function acceptSyncTransportCookies(TestResponse $response): void
{
    foreach ($response->headers->getCookies() as $cookie) {
        if (in_array($cookie->getName(), [config('session.cookie'), 'XSRF-TOKEN'], true)) {
            test()->withUnencryptedCookie($cookie->getName(), $cookie->getValue());
        }
    }
    Auth::forgetGuards();
    app('session')->forgetDrivers();
    app()->forgetInstance('session.store');
}

it('reproduces accepted push then unauthenticated headerless pull without logout and authenticates an origin-only referrer', function (): void {
    PostgresTestDatabase::refresh();
    $this->freezeTime();
    config(['session.driver' => 'database']);
    app('session')->forgetDrivers();
    app()->forgetInstance('session.store');
    $this->app->instance('env', 'local');
    [$owner, $church] = ChurchScenario::owner();
    [$teacher, $membership] = ChurchScenario::teacher($church);
    $teacher = User::findOrFail($teacher->id);
    $password = Str::password(32);
    $teacher->forceFill(['password' => $password])->save();
    $ministryId = MembershipScenario::ministry($church->id);
    DB::connection('pgsql_migration')->table('teacher_ministry_assignments')->insert([
        'id' => (string) Str::uuid(), 'church_id' => $church->id, 'membership_id' => $membership->id,
        'ministry_id' => $ministryId, 'assigned_by' => $owner->id, 'created_at' => now(), 'updated_at' => now(),
    ]);
    $this->withCredentials()->withHeader('Origin', config('app.url'))->withHeader('X-Church-Id', $church->id);
    $csrfResponse = $this->getJson('/sanctum/csrf-cookie')->assertNoContent();
    $csrf = collect($csrfResponse->headers->getCookies())->first(fn ($cookie) => $cookie->getName() === 'XSRF-TOKEN')->getValue();
    acceptSyncTransportCookies($csrfResponse);
    acceptSyncTransportCookies($this->postJson('/login', ['email' => $teacher->email, 'password' => $password], ['X-XSRF-TOKEN' => $csrf])->assertOk());
    $deviceId = (string) Str::uuid();
    acceptSyncTransportCookies($this->getJson('/api/offline/bootstrap?device_id='.$deviceId)->assertOk());
    $sessionId = (string) Str::uuid();
    $events = [];
    for ($index = 0; $index < 3; $index++) {
        $events[] = [
            'client_event_id' => (string) Str::uuid(), 'entity_id' => $sessionId,
            'action' => $index === 0 ? 'attendance.draft_created' : 'attendance.guest_added',
            'base_version' => $index, 'occurred_at' => now()->addSeconds($index)->toIso8601String(),
            'payload' => $index === 0
                ? ['ministry_id' => $ministryId, 'attendance_date' => now()->toDateString(), 'student_ids' => []]
                : ['display_name' => 'Isolated guest '.$index, 'gender' => 'unspecified'],
        ];
    }
    $csrfResponse = $this->getJson('/sanctum/csrf-cookie')->assertNoContent();
    $csrf = collect($csrfResponse->headers->getCookies())->first(fn ($cookie) => $cookie->getName() === 'XSRF-TOKEN')->getValue();
    acceptSyncTransportCookies($csrfResponse);
    $push = $this->postJson('/api/sync/push', ['device_id' => $deviceId, 'batch_id' => (string) Str::uuid(), 'events' => $events], ['X-XSRF-TOKEN' => $csrf])->assertOk();
    foreach ([0, 1, 2] as $index) {
        $push->assertJsonPath('results.'.$index.'.status', 'accepted')
            ->assertJsonPath('results.'.$index.'.record_id', $sessionId)
            ->assertJsonPath('results.'.$index.'.version', $index + 1);
    }
    acceptSyncTransportCookies($push);
    // The browser's no-referrer page suppresses Referer, and a same-origin GET supplies no Origin.
    $this->withoutHeaders(['Origin', 'Referer'])->withHeader('X-Device-Id', $deviceId);
    $denied = $this->getJson('/api/sync/pull?cursor=0&limit=100')->assertUnauthorized()->assertJsonPath('code', 'unauthenticated');
    acceptSyncTransportCookies($denied);
    // Keep the same cookies and clock: only restore the approved first-party origin referrer.
    $pull = $this->withHeader('Referer', rtrim(config('app.url'), '/').'/')
        ->getJson('/api/sync/pull?cursor=0&limit=100')->assertOk()->assertJsonPath('page.has_more', false);
    expect(count($pull->json('changes')))->toBe(3);
    acceptSyncTransportCookies($pull);
    acceptSyncTransportCookies($this->withHeader('Referer', 'https://untrusted.example/')
        ->getJson('/api/sync/pull?cursor=0&limit=100')->assertUnauthorized());
    $this->withHeader('Referer', rtrim(config('app.url'), '/').'/');
    $this->getJson('/auth/session')->assertOk()->assertJsonPath('id', $teacher->id);
});
