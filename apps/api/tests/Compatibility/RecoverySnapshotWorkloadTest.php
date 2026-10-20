<?php

use App\Domain\Sync\RecoveryCodec;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\IntegrationScenario as I;
use Tests\Support\MembershipScenario;
use Tests\Support\PostgresTestDatabase;
use Tests\Support\SnapshotScenario as S;
use Tests\TestCase;

uses(TestCase::class);
beforeEach(function (): void {
    I::guard();
    PostgresTestDatabase::refresh();
});
afterEach(function (): void {
    I::resetMode();
    DB::disconnect('pgsql');
    DB::disconnect('pgsql_migration');
});

it('measures complete bounded authoritative snapshot workloads and models transfer separately', function (int $count): void {
    $f = S::fixture($this);
    $db = DB::connection('pgsql_migration');
    $clock = CarbonImmutable::parse($db->scalar('SELECT clock_timestamp()'));
    $timezone = $db->table('churches')->where('id', $f['church']->id)->value('timezone');
    $today = $clock->setTimezone($timezone)->startOfDay();
    $guestCount = 0;
    for ($base = 0; $base < $count; $base += 90) {
        $ministry = MembershipScenario::ministry($f['church']->id);
        $students = [];
        for ($j = 0; $j < 10; $j++) {
            $student = Str::uuid()->toString();
            $students[] = $student;
            $db->table('students')->insert(['id' => $student, 'church_id' => $f['church']->id, 'first_name' => 'Synthetic', 'last_name' => 'Workload', 'gender' => 'unspecified', 'version' => 1]);
            $db->table('enrollments')->insert(['id' => Str::uuid()->toString(), 'church_id' => $f['church']->id, 'student_id' => $student, 'ministry_id' => $ministry, 'version' => 1]);
        }
        $sessions = $records = $guests = $revisions = [];
        for ($i = $base; $i < min($base + 90, $count); $i++) {
            $id = Str::uuid()->toString();
            $sessions[] = ['id' => $id, 'church_id' => $f['church']->id, 'ministry_id' => $ministry, 'attendance_date' => $today->subDays($i - $base)->toDateString(), 'status' => 'draft', 'version' => 1];
            foreach ($students as $j => $student) {
                $record = Str::uuid()->toString();
                $records[] = ['id' => $record, 'church_id' => $f['church']->id, 'attendance_session_id' => $id, 'student_id' => $student, 'state' => $j % 2 === 0 ? 'present' : 'absent', 'version' => 1];
                if ($j === 0 && $i % 10 === 0) {
                    $revisions[] = ['id' => Str::uuid()->toString(), 'church_id' => $f['church']->id, 'attendance_session_id' => $id, 'attendance_record_id' => $record,
                        'before_state' => 'present', 'after_state' => 'absent', 'resolving_actor_id' => $f['actor']->id, 'reason' => 'Synthetic workload correction', 'revised_at' => $clock];
                }
            }
            if ($i % 10 === 0) {
                $guestCount++;
                $guests[] = ['id' => Str::uuid()->toString(), 'church_id' => $f['church']->id, 'attendance_session_id' => $id, 'display_name' => 'Synthetic workload guest', 'gender' => 'unspecified', 'state' => 'present', 'status' => 'pending',
                    'created_by' => $f['actor']->id, 'source_device_id' => $f['device'], 'source_correlation_id' => Str::uuid()->toString(), 'occurred_at' => $clock, 'received_at' => $clock];
            }
        }
        $db->table('attendance_sessions')->insert($sessions);
        foreach (array_chunk($records, 500) as $chunk) {
            $db->table('attendance_records')->insert($chunk);
        }
        $db->table('attendance_guests')->insert($guests);
        $db->table('attendance_revisions')->insert($revisions);
    }
    $intent = S::intent($f);
    $run = S::domain($f, fn ($service) => $service->begin($f['request'], $intent));
    $input = S::bound($f, $run) + ['action' => 'manifest', 'ordinal' => 0, 'previous_digest' => null, 'items' => []];
    $a = S::domain($f, fn ($service) => $service->upload($f['request'], $input));
    $sealing = S::sealing($f, $run, [$a['page_digest']], 0);
    memory_reset_peak_usage();
    $start = hrtime(true);
    $ready = S::domain($f, fn ($service) => $service->seal($f['request'], $sealing));
    $elapsed = (hrtime(true) - $start) / 1e9;
    $peak = memory_get_peak_usage(true);
    $plain = $encrypted = $wire = $items = 0;
    $kinds = $digests = [];
    $maxPlain = $maxEnvelope = 0;
    foreach ($db->table('offline_recovery_pages')->where('run_id', $run['recovery_id'])->where('kind', 'output')->orderBy('ordinal')->lazy(25) as $row) {
        $page = RecoveryCodec::decode($row);
        expect($page['ordinal'])->toBe(count($digests))->and(count($page['items']))->toBeLessThanOrEqual(100);
        $digests[] = $row->content_digest;
        foreach ($page['items'] as $item) {
            $kinds[$item['type']] = ($kinds[$item['type']] ?? 0) + 1;
        }
        $plain += $row->plaintext_bytes;
        $encrypted += strlen($row->payload_ciphertext);
        $maxPlain = max($maxPlain, $row->plaintext_bytes);
        $maxEnvelope = max($maxEnvelope, strlen($row->payload_ciphertext));
        $items += $row->item_count;
        $response = new JsonResponse(['recovery_id' => $run['recovery_id'], 'page_digest' => $row->content_digest, 'manifest_digest' => $ready['manifest_digest'], 'page_count' => $ready['output_page_count'], 'client_recovered' => false, 'page' => $page]);
        $wire += strlen($response->getContent());
    }
    expect($ready['window_start'])->toBe($today->subDays(89)->toDateString())->and($ready['window_end'])->toBe($today->toDateString())
        ->and($kinds['session'])->toBe($count)->and($kinds['record'])->toBe($count * 10)->and($kinds['historical_student'])->toBe($count * 10)
        ->and($kinds['guest'])->toBe($guestCount)->and($kinds['revision'])->toBe($guestCount)
        ->and(RecoveryCodec::manifest($digests))->toBe($ready['manifest_digest'])->and($items)->toBe($ready['output_item_count'])
        ->and($maxPlain)->toBeLessThanOrEqual(1048576)->and($maxEnvelope)->toBeLessThanOrEqual(2097152);
    $retryStart = hrtime(true);
    $retry = S::domain($f, fn ($service) => $service->seal($f['request'], $sealing));
    $retrySeconds = (hrtime(true) - $retryStart) / 1e9;
    expect($retry)->toBe($ready);
    $bound = S::bound($f, $ready) + ['page' => $ready['output_page_count'] - 1];
    $last = S::domain($f, fn ($service) => $service->page($f['request'], $bound));
    expect($last['page_digest'])->toBe(end($digests))->and($db->table('device_cursors')->where('device_id', $f['device'])->value('applied_cursor'))->toBeNull();
    $stats = ['sessions' => $count, 'regularRecords' => $count * 10, 'guests' => $guestCount, 'revisions' => $guestCount,
        'constructionSecondsMeasured' => $elapsed, 'sealRetrySecondsMeasured' => $retrySeconds, 'phpPeakBytesMeasured' => $peak,
        'plaintextBytesMeasured' => $plain, 'encryptedBytesMeasured' => $encrypted, 'serializedPageResponseBytesMeasured' => $wire,
        'outputPages' => count($digests), 'items' => $items, 'maxPlaintextPage' => $maxPlain, 'maxEncryptedEnvelope' => $maxEnvelope,
        'transferSecondsModeled' => ['64000bit' => $wire * 8 / 64000, '256000bit' => $wire * 8 / 256000, '1000000bit' => $wire * 8 / 1000000],
        // An initially empty fixed window admits its first 120 requests without
        // a preceding wait. This ideal model excludes competing sync traffic.
        'configuredRateFloorSecondsModeled' => max(0, ceil((count($digests) + 3) / 120) - 1) * 60, 'qualificationLifetimeSeconds' => 14400,
        'sla' => false, 'modelExclusions' => 'HTTP headers,TLS,network latency,loss,retries,server queuing,competing sync traffic and client application;no production lifetime approved'];
    file_put_contents('/evidence/workload-'.$count.'-'.time().'.json', json_encode($stats, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT));
})->with([100, 1000, 10000]);
