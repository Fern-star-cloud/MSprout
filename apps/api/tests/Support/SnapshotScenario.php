<?php

namespace Tests\Support;

use App\Domain\Sync\ChurchCoordination;
use App\Domain\Sync\RecoveryCodec;
use App\Domain\Sync\RecoverySnapshots;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;

final class SnapshotScenario
{
    public static function fixture(object $test, bool $teacher = false): array
    {
        IntegrationScenario::guard();
        $test->useDatabaseCookieSessionBrowser();
        [$church, $actor, $member, $request, $ministry] = IntegrationScenario::ownerFixture($test);
        $ownerCookies = [];
        if ($teacher) {
            foreach ($test->getJson('/api/me')->assertOk()->headers->getCookies() as $cookie) {
                $ownerCookies[$cookie->getName()] = $cookie->getValue();
            }
            $owner = $actor;
            [$raw, $member] = ChurchScenario::teacher($church);
            $actor = User::findOrFail($raw->id);
            DB::connection('pgsql_migration')->table('teacher_ministry_assignments')->insert(['id' => (string) Str::uuid(), 'church_id' => $church->id, 'membership_id' => $member->id, 'ministry_id' => $ministry, 'assigned_by' => $owner->id]);
            PersistedChurchSession::authenticate($test, $actor);
            $request = Request::create('http://localhost/');
            $request->setLaravelSession(app('session.store'));
            $request->setUserResolver(fn () => $actor);
        }
        $device = (string) Str::uuid();
        $response = $test->getJson('/api/offline/bootstrap?device_id='.$device)->assertOk();
        $cookies = [];
        foreach ($response->headers->getCookies() as $cookie) {
            $cookies[$cookie->getName()] = $cookie->getValue();
        }
        IntegrationScenario::activate();
        config(['recovery.enabled' => true]);

        return compact('church', 'actor', 'member', 'request', 'ministry', 'device', 'cookies', 'ownerCookies');
    }

    public static function begin(object $test, array $f, array $patch = []): array
    {
        return $test->postJson('/api/offline/bootstrap/recovery', self::intent($f, $patch))->assertOk()->json();
    }

    public static function intent(array $f, array $patch = []): array
    {
        return array_replace(['action' => 'begin', 'schema' => RecoveryCodec::SCHEMA, 'device_id' => $f['device'], 'request_id' => (string) Str::uuid(), 'local_generation_id' => (string) Str::uuid()], $patch);
    }

    public static function bound(array $f, array $run): array
    {
        return ['schema' => RecoveryCodec::SCHEMA, 'device_id' => $f['device'], 'recovery_id' => $run['recovery_id'], 'generation' => $run['generation']];
    }

    public static function upload(object $test, array $f, array $run, array $items = [], int $ordinal = 0, ?string $previous = null): array
    {
        return $test->postJson('/api/offline/bootstrap/recovery', self::bound($f, $run) + ['action' => 'manifest', 'ordinal' => $ordinal, 'previous_digest' => $previous, 'items' => $items])->assertOk()->json();
    }

    public static function sealing(array $f, array $run, array $digests, int $items): array
    {
        return self::bound($f, $run) + ['action' => 'seal', 'input_page_count' => count($digests), 'input_item_count' => $items, 'input_manifest_digest' => RecoveryCodec::manifest($digests)];
    }

    public static function sealed(object $test, array $f, array $items = []): array
    {
        $run = self::begin($test, $f);
        $page = self::upload($test, $f, $run, $items);

        return $test->postJson('/api/offline/bootstrap/recovery', self::sealing($f, $run, [$page['page_digest']], count($items)))->assertOk()->json();
    }

    public static function read(object $test, array $f, array $run, int $ordinal = 0): TestResponse
    {
        $q = self::bound($f, $run);
        unset($q['schema']);

        return $test->getJson('/api/offline/bootstrap/recovery?'.http_build_query($q + ['page' => $ordinal]));
    }

    public static function items(object $test, array $f, array $run): array
    {
        $items = [];
        $digests = [];
        for ($i = 0; $i < $run['output_page_count']; $i++) {
            $page = self::read($test, $f, $run, $i)->assertOk()->assertHeader('Cache-Control', 'no-store, private')->json();
            expect(RecoveryCodec::digest($page['page']))->toBe($page['page_digest'])
                ->and(count($page['page']['items']))->toBeLessThanOrEqual(100);
            $items = [...$items, ...$page['page']['items']];
            $digests[] = $page['page_digest'];
        }
        expect(RecoveryCodec::manifest($digests))->toBe($run['manifest_digest'])->and(count($items))->toBe($run['output_item_count']);

        return $items;
    }

    public static function session(array $f, string $date, int $students = 1): array
    {
        $db = DB::connection('pgsql_migration');
        $id = (string) Str::uuid();
        $db->table('attendance_sessions')->insert(['id' => $id, 'church_id' => $f['church']->id, 'ministry_id' => $f['ministry'], 'attendance_date' => $date, 'version' => 1]);
        $records = [];
        for ($i = 0; $i < $students; $i++) {
            $student = (string) Str::uuid();
            $record = (string) Str::uuid();
            $db->table('students')->insert(['id' => $student, 'church_id' => $f['church']->id, 'first_name' => 'Synthetic', 'last_name' => 'Historical', 'date_of_birth' => '2015-01-01', 'gender' => 'unspecified', 'version' => 1]);
            $db->table('attendance_records')->insert(['id' => $record, 'church_id' => $f['church']->id, 'attendance_session_id' => $id, 'student_id' => $student, 'state' => 'present', 'version' => 1]);
            $records[] = ['id' => $record, 'student_id' => $student];
        }

        return ['id' => $id, 'records' => $records];
    }

    public static function event(string $entity, array $payload = []): array
    {
        return ['type' => 'event', 'event' => ['client_event_id' => (string) Str::uuid(), 'entity_id' => $entity, 'action' => 'attendance.student_marked', 'base_version' => 1, 'occurred_at' => now('UTC')->toISOString(), 'payload' => $payload]];
    }

    public static function domain(array $f, \Closure $call): mixed
    {
        return app(TenantContext::class)->run($f['church']->id, fn () => app(ChurchCoordination::class)->run($f['request'], fn () => $call(app(RecoverySnapshots::class))));
    }
}
