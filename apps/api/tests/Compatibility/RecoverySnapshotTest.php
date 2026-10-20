<?php

use App\Domain\Audit\AuditEntry;
use App\Domain\Audit\AuditWriter;
use App\Domain\Sync\RecoveryCodec;
use App\Domain\Sync\RecoveryException;
use App\Domain\Sync\RecoveryProjection;
use App\Support\Tenancy\TenantContext;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\IntegrationScenario as I;
use Tests\Support\PostgresTestDatabase;
use Tests\Support\SnapshotScenario as S;
use Tests\TestCase;

uses(TestCase::class);

beforeEach(function (): void {
    I::guard();
    PostgresTestDatabase::refresh();
});

it('leaves entry disabled by default and refuses production even with the qualification flag', function (): void {
    expect(config('recovery.enabled'))->toBeFalse();
    $f = S::fixture($this);
    config(['recovery.enabled' => false]);
    $this->withHeader('X-CSRF-TOKEN', app('session.store')->token())->postJson('/api/offline/bootstrap/recovery', S::intent($f))->assertNotFound();
    config(['recovery.enabled' => true]);
    app()->instance('env', 'production');
    $this->postJson('/api/offline/bootstrap/recovery', S::intent($f))->assertNotFound();
    app()->instance('env', 'testing');
    expect(DB::connection('pgsql_migration')->table('offline_recovery_runs')->count())->toBe(0);
});

it('makes begin idempotent rejects changed intent and supersedes only the prior generation', function (): void {
    $f = S::fixture($this);
    $intent = S::intent($f);
    $one = $this->postJson('/api/offline/bootstrap/recovery', $intent)->assertOk()->json();
    $this->postJson('/api/offline/bootstrap/recovery', $intent)->assertOk()->assertExactJson($one);
    $this->postJson('/api/offline/bootstrap/recovery', array_replace($intent, ['local_generation_id' => (string) Str::uuid()]))->assertConflict()->assertJsonPath('code', 'recovery_request_mismatch');
    $two = S::begin($this, $f);
    $this->postJson('/api/offline/bootstrap/recovery', $intent)->assertConflict();
    S::read($this, $f, $one)->assertConflict();
    $db = DB::connection('pgsql_migration');
    expect($db->table('offline_recovery_runs')->where('id', $one['recovery_id'])->value('state'))->toBe('superseded')
        ->and($db->table('device_cursors')->where('device_id', $f['device'])->value('active_recovery_id'))->toBe($two['recovery_id']);
});

it('seals a complete empty-work snapshot and serves identical authenticated no store pages without completion', function (): void {
    $f = S::fixture($this);
    $run = S::sealed($this, $f);
    expect($run['state'])->toBe('ready')->and($run['client_recovered'])->toBeFalse();
    $a = S::read($this, $f, $run)->assertOk()->json();
    S::read($this, $f, $run)->assertOk()->assertExactJson($a);
    S::items($this, $f, $run);
    $cursor = DB::connection('pgsql_migration')->table('device_cursors')->where('device_id', $f['device'])->first();
    expect($cursor->applied_cursor)->toBeNull()->and($cursor->full_resync_required)->toBeTrue()->and($cursor->receipt_coverage)->toBe('unknown');
    $this->withHeader('X-Device-Id', $f['device'])->getJson('/api/sync/pull')->assertConflict()->assertJsonPath('code', 'full_bootstrap_required');
    $this->getJson('/api/offline/bootstrap?device_id='.$f['device'])->assertConflict();
});

it('uses ninety church local dates plus every authorized older reference and preserved event target', function (): void {
    $f = S::fixture($this);
    $db = DB::connection('pgsql_migration');
    $db->table('churches')->where('id', $f['church']->id)->update(['timezone' => 'Pacific/Kiritimati']);
    $today = CarbonImmutable::now('Pacific/Kiritimati')->startOfDay();
    $within = S::session($f, $today->subDays(89)->toDateString());
    $outside = S::session($f, $today->subDays(90)->toDateString());
    $older = S::session($f, $today->subDays(180)->toDateString());
    $eventTarget = S::session($f, $today->subDays(181)->toDateString());
    $future = S::session($f, $today->addDay()->toDateString());
    $event = S::event($eventTarget['id'], ['state' => 'absent']);
    $run = S::sealed($this, $f, [['type' => 'reference', 'session_id' => $older['id']], ['type' => 'reference', 'session_id' => $future['id']], $event]);
    $items = S::items($this, $f, $run);
    $ids = array_column(array_filter($items, fn ($i) => $i['type'] === 'session'), 'id');
    expect($ids)->toEqualCanonicalizing([$within['id'], $older['id'], $eventTarget['id']])
        ->and($run['window_start'])->toBe($today->subDays(89)->toDateString())->and($run['window_end'])->toBe($today->toDateString())
        ->and($db->table('change_feed')->count())->toBe(0)->and($db->table('sync_events')->count())->toBe(0);
    expect(collect($items)->where('type', 'reference')->keyBy('id')[$future['id']]['availability'])->toBe('unavailable');
});

it('preserves historical membership corrections guests and conflict provenance without sensitive fields', function (): void {
    $f = S::fixture($this);
    $s = S::session($f, now()->toDateString(), 2);
    $db = DB::connection('pgsql_migration');
    $db->table('students')->where('id', $s['records'][0]['student_id'])->update(['deleted_at' => now()]);
    $db->table('enrollments')->insert(['id' => (string) Str::uuid(), 'church_id' => $f['church']->id, 'ministry_id' => $f['ministry'], 'student_id' => $s['records'][1]['student_id'], 'version' => 1]);
    $conflict = (string) Str::uuid();
    $db->table('sync_conflicts')->insert(['id' => $conflict, 'church_id' => $f['church']->id, 'attendance_session_id' => $s['id'], 'attendance_record_id' => $s['records'][0]['id'],
        'incoming_event_id' => (string) Str::uuid(), 'field' => 'state', 'base_version' => 1, 'existing_value' => '{"state":"present","private":"DO_NOT_COPY"}', 'incoming_value' => '{"state":"absent"}',
        'incoming_actor_id' => $f['actor']->id, 'incoming_device_id' => (string) Str::uuid(), 'incoming_correlation_id' => (string) Str::uuid(), 'incoming_occurred_at' => now(), 'incoming_received_at' => now(), 'was_finalized' => false]);
    $db->table('attendance_revisions')->insert(['id' => (string) Str::uuid(), 'church_id' => $f['church']->id, 'attendance_session_id' => $s['id'], 'attendance_record_id' => $s['records'][0]['id'],
        'sync_conflict_id' => $conflict, 'before_state' => 'present', 'after_state' => 'absent', 'resolving_actor_id' => $f['actor']->id, 'reason' => 'PRIVATE_REASON_DO_NOT_COPY', 'revised_at' => now()]);
    $guest = (string) Str::uuid();
    $db->table('attendance_guests')->insert(['id' => $guest, 'church_id' => $f['church']->id, 'attendance_session_id' => $s['id'], 'display_name' => 'Synthetic guest', 'gender' => 'unspecified', 'state' => 'present', 'status' => 'linked',
        'created_by' => $f['actor']->id, 'source_device_id' => $f['device'], 'source_correlation_id' => (string) Str::uuid(), 'occurred_at' => now(), 'received_at' => now(),
        'resolved_student_id' => $s['records'][1]['student_id'], 'resolved_by' => $f['actor']->id, 'resolved_at' => now()]);
    $run = S::sealed($this, $f);
    $items = S::items($this, $f, $run);
    $records = collect($items)->where('type', 'record')->keyBy('id');
    expect($records[$s['records'][0]['id']]['original_state'])->toBe('present')->and($records[$s['records'][0]['id']]['state'])->toBe('absent')
        ->and(collect($items)->where('type', 'historical_student')->count())->toBe(2)
        ->and(collect($items)->where('type', 'roster_student')->count())->toBe(1)
        ->and(collect($items)->where('type', 'guest')->first()['resolved_student_id'])->toBe($s['records'][1]['student_id']);
    $json = json_encode($items);
    expect($json)->not->toContain('date_of_birth', 'PRIVATE_REASON', 'DO_NOT_COPY', 'existing_actor_id', 'source_device_id');
});

it('fragments large sessions into complete typed children and bounded immutable pages', function (): void {
    $f = S::fixture($this);
    $s = S::session($f, now()->toDateString(), 150);
    $run = S::sealed($this, $f);
    $items = S::items($this, $f, $run);
    expect($run['output_page_count'])->toBeGreaterThan(3)
        ->and(collect($items)->where('type', 'record')->count())->toBe(150)
        ->and(collect($items)->where('type', 'session')->first()['fragment_counts']['records'])->toBe(150);
    $this->postJson('/api/offline/bootstrap/recovery', S::sealing($f, $run, [$run['input_manifest_digest']], 0))->assertConflict();
    app(TenantContext::class)->run($f['church']->id, function () use ($run): void {
        expect(fn () => DB::table('offline_recovery_pages')->where('run_id', $run['recovery_id'])->update(['content_digest' => str_repeat('a', 64)]))->toThrow(QueryException::class);
    });
});

it('preserves original missing-target events encrypted and makes no acceptance inference', function (): void {
    $f = S::fixture($this);
    $event = S::event((string) Str::uuid(), ['state' => 'absent', 'display_name' => 'ENCRYPTED_PRIVATE_ORIGINAL']);
    $run = S::sealed($this, $f, [$event]);
    $db = DB::connection('pgsql_migration');
    $stored = $db->table('offline_recovery_pages')->where('run_id', $run['recovery_id'])->where('kind', 'input')->first();
    expect($stored->payload_ciphertext)->not->toContain('ENCRYPTED_PRIVATE_ORIGINAL')->and(RecoveryCodec::decode($stored)['items'][0])->toEqual($event);
    $items = S::items($this, $f, $run);
    expect(collect($items)->where('type', 'reference')->first()['availability'])->toBe('unavailable')
        ->and($db->table('sync_events')->count())->toBe(0);
});

it('accepts identical page retries and rejects mismatched reorders omissions totals and digests', function (): void {
    $f = S::fixture($this);
    $run = S::begin($this, $f);
    S::read($this, $f, $run)->assertConflict();
    $bound = S::bound($f, $run);
    $this->postJson('/api/offline/bootstrap/recovery', $bound + ['action' => 'manifest', 'ordinal' => 1, 'previous_digest' => null, 'items' => []])->assertConflict();
    $a = S::upload($this, $f, $run);
    expect(S::upload($this, $f, $run))->toEqual($a);
    $this->postJson('/api/offline/bootstrap/recovery', $bound + ['action' => 'manifest', 'ordinal' => 0, 'previous_digest' => null, 'items' => [['type' => 'reference', 'session_id' => (string) Str::uuid()]]])->assertConflict();
    foreach ([['input_page_count' => 2], ['input_item_count' => 1], ['input_manifest_digest' => str_repeat('a', 64)]] as $bad) {
        $this->postJson('/api/offline/bootstrap/recovery', array_replace(S::sealing($f, $run, [$a['page_digest']], 0), $bad))->assertConflict();
    }
    $seal = S::sealing($f, $run, [$a['page_digest']], 0);
    $result = $this->postJson('/api/offline/bootstrap/recovery', $seal)->assertOk()->json();
    $this->postJson('/api/offline/bootstrap/recovery', $seal)->assertOk()->assertExactJson($result);
});

it('rejects duplicate reference or original-event identities across pages', function (string $kind): void {
    $f = S::fixture($this);
    $run = S::begin($this, $f);
    $item = $kind === 'reference' ? ['type' => 'reference', 'session_id' => (string) Str::uuid()] : S::event((string) Str::uuid());
    $a = S::upload($this, $f, $run, [$item]);
    $b = S::upload($this, $f, $run, [$item], 1, $a['page_digest']);
    $this->postJson('/api/offline/bootstrap/recovery', S::sealing($f, $run, [$a['page_digest'], $b['page_digest']], 2))->assertConflict()->assertJsonPath('code', 'recovery_duplicate_identity');
    expect(DB::connection('pgsql_migration')->table('offline_recovery_pages')->where('kind', 'output')->count())->toBe(0);
})->with(['reference', 'event']);

it('rejects unknown schemas ownership fields client cursors malformed and oversized inputs', function (): void {
    $f = S::fixture($this);
    foreach ([['schema' => 'unknown'], ['cursor' => '-1'], ['snapshot_cursor' => '9223372036854775808'], ['church_id' => (string) Str::uuid()], ['actor_id' => 1]] as $patch) {
        $this->postJson('/api/offline/bootstrap/recovery', S::intent($f, $patch))->assertUnprocessable();
    }
    $run = S::begin($this, $f);
    foreach ([[['type' => 'arbitrary']], array_fill(0, 101, ['type' => 'reference', 'session_id' => (string) Str::uuid()]), [S::event((string) Str::uuid(), ['large' => str_repeat('x', 1048576)])]] as $items) {
        $this->postJson('/api/offline/bootstrap/recovery', S::bound($f, $run) + ['action' => 'manifest', 'ordinal' => 0, 'previous_digest' => null, 'items' => $items])->assertUnprocessable();
    }
    expect(DB::connection('pgsql_migration')->table('offline_recovery_pages')->count())->toBe(0);
});

it('rolls back incomplete output and required audit and safely retries the preserved input', function (): void {
    $f = S::fixture($this);
    $run = S::begin($this, $f);
    $a = S::upload($this, $f, $run);
    $this->partialMock(AuditWriter::class, fn ($mock) => $mock->shouldReceive('record')->withArgs(fn (AuditEntry $e) => $e->action === 'offline.recovery.sealed')->andThrow(new RuntimeException('isolated audit failure')));
    $seal = S::sealing($f, $run, [$a['page_digest']], 0);
    $this->postJson('/api/offline/bootstrap/recovery', $seal)->assertStatus(500);
    $db = DB::connection('pgsql_migration');
    expect($db->table('offline_recovery_pages')->where('kind', 'output')->count())->toBe(0)
        ->and($db->table('offline_recovery_runs')->where('id', $run['recovery_id'])->value('state'))->toBe('collecting')
        ->and($db->table('offline_recovery_pages')->where('kind', 'input')->count())->toBe(1);
    $this->swap(AuditWriter::class, new AuditWriter);
    $this->postJson('/api/offline/bootstrap/recovery', $seal)->assertOk();
});

it('refuses changed roster or ministry scope without revealing saved pages', function (string $kind): void {
    $f = S::fixture($this);
    $s = S::session($f, now()->toDateString());
    $db = DB::connection('pgsql_migration');
    $db->table('enrollments')->insert(['id' => (string) Str::uuid(), 'church_id' => $f['church']->id, 'student_id' => $s['records'][0]['student_id'], 'ministry_id' => $f['ministry'], 'version' => 1]);
    $run = S::sealed($this, $f);
    if ($kind === 'roster') {
        $db->table('students')->where('id', $s['records'][0]['student_id'])->update(['version' => 2]);
    } else {
        $db->table('ministries')->where('id', $f['ministry'])->update(['version' => 2]);
    }
    S::read($this, $f, $run)->assertConflict()->assertJsonPath('code', 'recovery_scope_changed');
})->with(['roster', 'ministry']);

it('refuses incomplete coverage epochs and preserves recovery and applied fences', function (string $kind): void {
    $f = S::fixture($this);
    $db = DB::connection('pgsql_migration');
    if ($kind === 'missing') {
        $db->table('sync_recovery_progress')->where('church_id', $f['church']->id)->delete();
    } else {
        $db->statement('ALTER TABLE sync_recovery_progress DISABLE TRIGGER recovery_progress_guard');
        try {
            $db->table('sync_recovery_progress')->where('church_id', $f['church']->id)->update(['history_baselined_at' => null]);
        } finally {
            $db->statement('ALTER TABLE sync_recovery_progress ENABLE TRIGGER recovery_progress_guard');
        }
    }
    $this->postJson('/api/offline/bootstrap/recovery', S::intent($f))->assertConflict()->assertJsonPath('code', 'recovery_cut_unqualified');
    expect($db->table('offline_recovery_runs')->count())->toBe(0);
})->with(['missing', 'unqualified']);

it('refuses actual expiry without extending the lifetime or losing original input', function (): void {
    $f = S::fixture($this);
    config(['recovery.lifetime_seconds' => 1]);
    $run = S::begin($this, $f);
    S::upload($this, $f, $run, [S::event((string) Str::uuid())]);
    $db = DB::connection('pgsql_migration');
    $db->select('SELECT pg_sleep(GREATEST(0,EXTRACT(EPOCH FROM (expires_at-clock_timestamp())))+0.01) FROM offline_recovery_runs WHERE id=?', [$run['recovery_id']]);
    S::read($this, $f, $run)->assertConflict();
    expect($db->table('offline_recovery_pages')->where('kind', 'input')->count())->toBe(1)
        ->and(CarbonImmutable::parse($db->table('offline_recovery_runs')->where('id', $run['recovery_id'])->value('expires_at'))->toISOString())->toBe($run['expires_at']);
});

it('detects authenticated ciphertext or digest tampering and denies direct SQL completion', function (): void {
    $f = S::fixture($this);
    $run = S::sealed($this, $f);
    $row = DB::connection('pgsql_migration')->table('offline_recovery_pages')->where('run_id', $run['recovery_id'])->first();
    $bad = clone $row;
    $bad->content_digest = str_repeat('a', 64);
    expect(fn () => RecoveryCodec::decode($bad))->toThrow(RecoveryException::class);
    $bad = clone $row;
    $bad->payload_ciphertext = strrev($row->payload_ciphertext);
    expect(fn () => RecoveryCodec::decode($bad))->toThrow(RecoveryException::class);
    app(TenantContext::class)->run($f['church']->id, function () use ($run): void {
        expect(fn () => DB::transaction(fn () => DB::select('SELECT transition_recovery_run(?,?,?::jsonb)', [$run['recovery_id'], 'ready', '{"state":"client_confirmed"}'])))->toThrow(QueryException::class);
        expect(fn () => DB::transaction(fn () => DB::table('device_cursors')->update(['applied_cursor' => (int) $run['snapshot_cursor'], 'applied_generation' => $run['generation'], 'applied_coverage_epoch' => $run['coverage_epoch'], 'applied_scope_digest' => DB::table('offline_recovery_runs')->where('id', $run['recovery_id'])->value('scope_digest'), 'applied_evidence_at' => now()])))->toThrow(QueryException::class);
    });
});

afterEach(function (): void {
    CarbonImmutable::setTestNow();
    I::resetMode();
    DB::disconnect('pgsql');
    DB::disconnect('pgsql_migration');
});

/** Only the scope-clock query is controlled; expiry and SQL safety clocks stay real. */
function snapshotDateClock(CarbonImmutable &$clock): void
{
    CarbonImmutable::setTestNow(function () use (&$clock) {
        return $clock;
    });
    $real = DB::getFacadeRoot();
    $manager = Mockery::mock($real);
    $manager->shouldReceive('scalar')->andReturnUsing(function ($sql, ...$arguments) use ($real, &$clock) {
        return $sql === 'SELECT clock_timestamp() AS recovery_scope_clock'
            ? $clock->toISOString() : $real->scalar($sql, ...$arguments);
    });
    DB::swap($manager);
}

it('P2-2-REV-01 refuses yesterday generations and binds a fresh church local window without settling originals', function (string $timezone, string $instant): void {
    $clock = CarbonImmutable::parse($instant);
    snapshotDateClock($clock);
    $f = S::fixture($this);
    $db = DB::connection('pgsql_migration');
    $db->table('churches')->where('id', $f['church']->id)->update(['timezone' => $timezone]);
    $today = $clock->setTimezone($timezone)->startOfDay();
    $edge = S::session($f, $today->subDays(89)->toDateString());
    $next = S::session($f, $today->addDay()->toDateString());
    $older = S::session($f, $today->subDays(180)->toDateString());
    $original = S::event($older['id'], ['state' => 'absent']);
    $intent = S::intent($f);
    $run = $this->postJson('/api/offline/bootstrap/recovery', $intent)->assertOk()->json();
    $input = S::upload($this, $f, $run, [$original]);
    $seal = S::sealing($f, $run, [$input['page_digest']], 1);
    $ready = $this->postJson('/api/offline/bootstrap/recovery', $seal)->assertOk()->json();
    $before = S::read($this, $f, $ready)->assertOk()->assertJsonPath('client_recovered', false)->json();
    expect($ready['window_start'])->toBe($today->subDays(89)->toDateString())
        ->and($ready['window_end'])->toBe($today->toDateString())
        ->and($before['page']['scope_digest'])->toBe($db->table('offline_recovery_runs')->where('id', $run['recovery_id'])->value('authority_digest'));
    $saved = $db->table('offline_recovery_pages')->where('run_id', $run['recovery_id'])->orderBy('kind')->orderBy('ordinal')->get()->toArray();
    $device = (array) $db->table('device_cursors')->where('device_id', $f['device'])->first();
    $clock = $clock->addMilliseconds(200);
    S::read($this, $f, $ready)->assertConflict()->assertJsonPath('code', 'recovery_scope_changed');
    $this->postJson('/api/offline/bootstrap/recovery', $seal)->assertConflict()->assertJsonPath('code', 'recovery_scope_changed');
    $this->postJson('/api/offline/bootstrap/recovery', $intent)->assertConflict()->assertJsonPath('code', 'recovery_scope_changed');
    $this->postJson('/api/offline/bootstrap/recovery', S::bound($f, $run) + ['action' => 'manifest', 'ordinal' => 0, 'previous_digest' => null, 'items' => [$original]])
        ->assertConflict()->assertJsonPath('code', 'recovery_scope_changed');
    expect($db->table('offline_recovery_pages')->where('run_id', $run['recovery_id'])->orderBy('kind')->orderBy('ordinal')->get()->toArray())->toEqual($saved)
        ->and((array) $db->table('device_cursors')->where('device_id', $f['device'])->first())->toEqual($device)
        ->and($device['full_resync_required'])->toBeTrue()->and($device['applied_cursor'])->toBeNull()
        ->and($device['receipt_coverage'])->toBe('unknown')->and($db->table('sync_events')->count())->toBe(0);
    $fresh = S::sealed($this, $f, [$original]);
    $items = S::items($this, $f, $fresh);
    expect($fresh['window_start'])->toBe($today->subDays(88)->toDateString())
        ->and($fresh['window_end'])->toBe($today->addDay()->toDateString())
        ->and(collect($items)->where('type', 'session')->pluck('id')->all())->toEqualCanonicalizing([$next['id'], $older['id']])
        ->and(collect($items)->where('type', 'session')->pluck('id')->all())->not->toContain($edge['id'])
        ->and($fresh['generation'])->not->toBe($ready['generation'])
        ->and($db->table('offline_recovery_runs')->where('id', $fresh['recovery_id'])->value('authority_digest'))->not->toBe($before['page']['scope_digest']);
    $stored = $db->table('offline_recovery_pages')->where('run_id', $run['recovery_id'])->where('kind', 'input')->first();
    expect(RecoveryCodec::json(RecoveryCodec::decode($stored)['items']))->toBe(RecoveryCodec::json([$original]));
})->with([
    'UTC+14 rollover' => ['Pacific/Kiritimati', '2026-10-19T09:59:59.900000Z'],
    'UTC-09 rollover' => ['America/Adak', '2026-10-20T08:59:59.900000Z'],
]);

it('P2-2-REV-01 refuses a collecting generation sealed after local midnight and preserves its input and hold', function (): void {
    $clock = CarbonImmutable::parse('2026-10-19T09:59:59.900000Z');
    snapshotDateClock($clock);
    $f = S::fixture($this);
    DB::connection('pgsql_migration')->table('churches')->where('id', $f['church']->id)->update(['timezone' => 'Pacific/Kiritimati']);
    $run = S::begin($this, $f);
    $original = S::event((string) Str::uuid());
    $input = S::upload($this, $f, $run, [$original]);
    $clock = $clock->addMilliseconds(200);
    $this->postJson('/api/offline/bootstrap/recovery', S::sealing($f, $run, [$input['page_digest']], 1))
        ->assertConflict()->assertJsonPath('code', 'recovery_scope_changed');
    $db = DB::connection('pgsql_migration');
    expect($db->table('offline_recovery_runs')->where('id', $run['recovery_id'])->value('state'))->toBe('collecting')
        ->and($db->table('offline_recovery_pages')->where('kind', 'output')->count())->toBe(0)
        ->and(RecoveryCodec::json(RecoveryCodec::decode($db->table('offline_recovery_pages')->where('kind', 'input')->first())['items']))->toBe(RecoveryCodec::json([$original]))
        ->and($db->table('device_cursors')->where('device_id', $f['device'])->value('active_recovery_id'))->toBe($run['recovery_id']);
});

it('P2-2-REV-01 rolls back a seal crossing midnight during output or required audit', function (string $phase): void {
    $clock = CarbonImmutable::parse('2026-10-19T09:59:59.900000Z');
    snapshotDateClock($clock);
    $f = S::fixture($this);
    $db = DB::connection('pgsql_migration');
    $db->table('churches')->where('id', $f['church']->id)->update(['timezone' => 'Pacific/Kiritimati']);
    S::session($f, '2026-10-19', 60);
    $run = S::begin($this, $f);
    $original = S::event((string) Str::uuid());
    $input = S::upload($this, $f, $run, [$original]);
    $saved = $db->table('offline_recovery_pages')->where('kind', 'input')->get()->toArray();
    $device = (array) $db->table('device_cursors')->where('device_id', $f['device'])->first();
    $crossed = false;
    if ($phase !== 'audit') {
        DB::listen(function ($query) use (&$clock, &$crossed, $db, $phase): void {
            $prefix = $phase === 'output' ? 'insert into "offline_recovery_pages"' : 'select "content_digest" from "offline_recovery_pages"';
            if (! $crossed && str_starts_with($query->sql, $prefix) && in_array('output', $query->bindings, true)) {
                $crossed = true;
                expect(DB::table('offline_recovery_pages')->where('kind', 'output')->count())->toBeGreaterThan(0)
                    ->and($db->table('offline_recovery_pages')->where('kind', 'output')->count())->toBe(0);
                $clock = $clock->addMilliseconds(200);
            }
        });
    } else {
        $writer = app(AuditWriter::class);
        $this->partialMock(AuditWriter::class, function ($mock) use ($writer, &$clock, &$crossed): void {
            $mock->shouldReceive('record')->withArgs(fn (AuditEntry $e) => $e->action === 'offline.recovery.sealed')
                ->andReturnUsing(function (AuditEntry $e) use ($writer, &$clock, &$crossed): void {
                    $writer->record($e);
                    $crossed = true;
                    $clock = $clock->addMilliseconds(200);
                });
        });
    }
    $this->postJson('/api/offline/bootstrap/recovery', S::sealing($f, $run, [$input['page_digest']], 1))
        ->assertConflict()->assertJsonPath('code', 'recovery_scope_changed');
    expect($crossed)->toBeTrue()->and($db->table('offline_recovery_runs')->where('id', $run['recovery_id'])->value('state'))->toBe('collecting')
        ->and($db->table('offline_recovery_runs')->where('id', $run['recovery_id'])->value('snapshot_cursor'))->toBeNull()
        ->and($db->table('offline_recovery_pages')->where('kind', 'output')->count())->toBe(0)
        ->and($db->table('offline_recovery_pages')->where('kind', 'input')->get()->toArray())->toEqual($saved)
        ->and($db->table('audit_events')->where('action', 'offline.recovery.sealed')->count())->toBe(0)
        ->and((array) $db->table('device_cursors')->where('device_id', $f['device'])->first())->toEqual($device)
        ->and($db->table('sync_events')->count())->toBe(0);
})->with(['output', 'audit', 'metadata']);

it('P2-2-REV-01 refuses a page crossing midnight while reading immutable output', function (): void {
    $clock = CarbonImmutable::parse('2026-10-19T09:59:59.900000Z');
    snapshotDateClock($clock);
    $f = S::fixture($this);
    DB::connection('pgsql_migration')->table('churches')->where('id', $f['church']->id)->update(['timezone' => 'Pacific/Kiritimati']);
    $run = S::sealed($this, $f);
    $crossed = false;
    DB::listen(function ($query) use (&$clock, &$crossed): void {
        if (! $crossed && str_starts_with($query->sql, 'select * from "offline_recovery_pages"') && in_array('output', $query->bindings, true)) {
            $crossed = true;
            $clock = $clock->addMilliseconds(200);
        }
    });
    S::read($this, $f, $run)->assertConflict()->assertJsonPath('code', 'recovery_scope_changed');
    expect($crossed)->toBeTrue();
});

it('P2-2-REV-01 rolls back begin or upload crossing midnight without changing already saved work', function (string $action): void {
    $clock = CarbonImmutable::parse('2026-10-19T09:59:59.900000Z');
    snapshotDateClock($clock);
    $f = S::fixture($this);
    $db = DB::connection('pgsql_migration');
    $db->table('churches')->where('id', $f['church']->id)->update(['timezone' => 'Pacific/Kiritimati']);
    $crossed = false;
    if ($action === 'begin') {
        $writer = app(AuditWriter::class);
        $this->partialMock(AuditWriter::class, function ($mock) use ($writer, &$clock, &$crossed): void {
            $mock->shouldReceive('record')->withArgs(fn (AuditEntry $e) => $e->action === 'offline.recovery.begun')
                ->andReturnUsing(function (AuditEntry $e) use ($writer, &$clock, &$crossed): void {
                    $writer->record($e);
                    $crossed = true;
                    $clock = $clock->addMilliseconds(200);
                });
        });
        $request = S::intent($f);
    } else {
        $run = S::begin($this, $f);
        $page = S::upload($this, $f, $run, [S::event((string) Str::uuid())]);
        $request = S::bound($f, $run) + ['action' => 'manifest', 'ordinal' => 1, 'previous_digest' => $page['page_digest'], 'items' => []];
        DB::listen(function ($query) use (&$clock, &$crossed): void {
            if (! $crossed && str_starts_with($query->sql, 'insert into "offline_recovery_pages"') && in_array('input', $query->bindings, true)) {
                $crossed = true;
                $clock = $clock->addMilliseconds(200);
            }
        });
    }
    $saved = $db->table('offline_recovery_pages')->orderBy('kind')->orderBy('ordinal')->get()->toArray();
    $device = (array) $db->table('device_cursors')->where('device_id', $f['device'])->first();
    $this->postJson('/api/offline/bootstrap/recovery', $request)->assertConflict()->assertJsonPath('code', 'recovery_scope_changed');
    expect($crossed)->toBeTrue()
        ->and($db->table('offline_recovery_pages')->orderBy('kind')->orderBy('ordinal')->get()->toArray())->toEqual($saved)
        ->and((array) $db->table('device_cursors')->where('device_id', $f['device'])->first())->toEqual($device)
        ->and($db->table('sync_events')->count())->toBe(0);
    if ($action === 'begin') {
        expect($db->table('offline_recovery_runs')->count())->toBe(0)
            ->and($db->table('audit_events')->where('action', 'offline.recovery.begun')->count())->toBe(0);
    } else {
        expect($db->table('offline_recovery_runs')->where('id', $run['recovery_id'])->value('input_page_count'))->toBe(1);
    }
})->with(['begin', 'upload']);

it('P2-2-REV-01 uses the database date basis despite an application clock skew and never recalculates a captured window', function (): void {
    $clock = CarbonImmutable::parse('2026-10-19T09:59:59.900000Z');
    snapshotDateClock($clock);
    $f = S::fixture($this);
    DB::connection('pgsql_migration')->table('churches')->where('id', $f['church']->id)->update(['timezone' => 'Pacific/Kiritimati']);
    app(TenantContext::class)->run($f['church']->id, function () use ($f, &$clock): void {
        $projection = app(RecoveryProjection::class);
        $scope = $projection->scope($f['member']);
        CarbonImmutable::setTestNow($clock->addDays(2));
        expect($projection->scope($f['member'])['digest'])->toBe($scope['digest'])
            ->and($projection->window($scope))->toBe(['2026-07-22', '2026-10-19']);
        $clock = $clock->addMilliseconds(200);
        expect($projection->window($scope))->toBe(['2026-07-22', '2026-10-19'])
            ->and(fn () => $projection->assertCurrent($scope))->toThrow(RecoveryException::class);
    });
});

it('rejects input deeper than the authenticated page reader can decode without saving an unreadable original', function (): void {
    $f = S::fixture($this);
    $run = S::begin($this, $f);
    $payload = ['original' => true];
    for ($i = 0; $i < 70; $i++) {
        $payload = ['nested' => $payload];
    }
    $this->postJson('/api/offline/bootstrap/recovery', S::bound($f, $run) + [
        'action' => 'manifest', 'ordinal' => 0, 'previous_digest' => null,
        'items' => [S::event((string) Str::uuid(), $payload)],
    ])->assertUnprocessable();
    expect(DB::connection('pgsql_migration')->table('offline_recovery_pages')->where('run_id', $run['recovery_id'])->count())->toBe(0);
});

it('begins an opt in generation without claiming recovered work or applied progress', function (): void {
    [$church, $actor, $member] = I::ownerFixture($this);
    $device = (string) Str::uuid();
    $this->getJson('/api/offline/bootstrap?device_id='.$device)->assertOk();
    I::activate();
    config(['recovery.enabled' => true]);
    $result = $this->postJson('/api/offline/bootstrap/recovery', [
        'action' => 'begin', 'schema' => 'attendance-recovery-v1', 'device_id' => $device,
        'request_id' => (string) Str::uuid(), 'local_generation_id' => (string) Str::uuid(),
    ])->assertOk()->assertJsonPath('state', 'collecting')->assertJsonPath('client_recovered', false);
    $row = DB::connection('pgsql_migration')->table('device_cursors')->where('device_id', $device)->first();
    expect($row->active_recovery_id)->toBe($result->json('recovery_id'))
        ->and($row->full_resync_required)->toBeTrue()->and($row->applied_cursor)->toBeNull()
        ->and($row->receipt_coverage)->toBe('unknown');
});
