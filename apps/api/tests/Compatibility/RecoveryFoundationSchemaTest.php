<?php

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\Support\ChurchScenario;
use Tests\Support\MaintenanceScenario;
use Tests\Support\PostgresTestDatabase;
use Tests\TestCase;

uses(TestCase::class);

beforeEach(function (): void {
    PostgresTestDatabase::refresh();
});

it('provides additive recovery foundations without activating a church baseline', function (): void {
    expect(Schema::hasTable('sync_recovery_progress'))->toBeTrue();
    expect(DB::connection('pgsql_migration')->table('sync_recovery_progress')->count())->toBe(0);
});

function p21Fixture(array $limits = []): array
{
    [$user, $church, $membership] = ChurchScenario::owner();
    $admin = DB::connection('pgsql_migration');
    $device = (string) Str::uuid();
    $epoch = (string) Str::uuid();
    $admin->table('device_cursors')->insert(['id' => (string) Str::uuid(), 'church_id' => $church->id, 'membership_id' => $membership->id, 'device_id' => $device, 'cursor' => 9000, 'updated_at' => now()]);
    $admin->table('sync_recovery_progress')->insert(['church_id' => $church->id, 'feed_head' => 7, 'baseline_sequence_floor' => 11, 'coverage_epoch' => $epoch, 'history_baselined_at' => now(), 'updated_at' => now()]);
    $run = ['id' => (string) Str::uuid(), 'church_id' => $church->id, 'membership_id' => $membership->id, 'device_id' => $device, 'actor_id' => $user->id, 'request_id' => (string) Str::uuid(), 'local_generation_id' => (string) Str::uuid(), 'generation' => (string) Str::uuid(), 'coverage_epoch' => $epoch, 'created_at' => now(), 'expires_at' => $limits['expires_at'] ?? now()->addMinutes(30)] + $limits + ['max_input_pages' => 2, 'max_output_pages' => 2, 'max_items' => 8, 'max_stored_bytes' => 32];
    p21Scope($church->id, fn () => DB::table('offline_recovery_runs')->insert($run));

    return [$church->id, $run];
}

function p21Scope(string $church, Closure $action): mixed
{
    return DB::transaction(function () use ($church, $action) {
        DB::selectOne("SELECT set_config('app.current_church_id', ?, true)", [$church]);

        return $action();
    });
}

function p21Page(array $run, string $kind = 'input', int $ordinal = 0, string $payload = 'abcd'): void
{
    DB::table('offline_recovery_pages')->insert(['church_id' => $run['church_id'], 'run_id' => $run['id'], 'kind' => $kind, 'ordinal' => $ordinal, 'item_count' => 1, 'plaintext_bytes' => 1, 'content_digest' => str_repeat('a', 64), 'payload_ciphertext' => $payload, 'created_at' => now()]);
}

function p21Transition(array $run, array $patch, string $expected = 'collecting'): void
{
    DB::select('SELECT transition_recovery_run(?::uuid,?::varchar,?::jsonb)', [$run['id'], $expected, json_encode($patch, JSON_THROW_ON_ERROR)]);
}

function p21Ready(): array
{
    return ['state' => 'ready', 'input_manifest_digest' => str_repeat('a', 64), 'snapshot_manifest_digest' => str_repeat('b', 64), 'scope_digest' => str_repeat('c', 64), 'snapshot_cursor' => 11, 'window_start' => now()->subDays(89)->toDateString(), 'window_end' => now()->toDateString(), 'timezone' => 'Asia/Taipei'];
}

it('never converts a large served cursor into applied or receipt evidence', function (): void {
    [$church, $run] = p21Fixture();
    $row = p21Scope($church, fn () => DB::table('device_cursors')->where('device_id', $run['device_id'])->first());
    expect((int) $row->cursor)->toBe(9000)->and($row->applied_cursor)->toBeNull()
        ->and($row->applied_coverage_epoch)->toBeNull()->and($row->receipt_coverage)->toBe('unknown');
});

it('RC-01 refuses runtime fabricated complete receipt coverage on a new device', function (): void {
    [$church, $run] = p21Fixture();
    expect((bool) DB::scalar("SELECT has_table_privilege(current_user,'device_cursors','INSERT')"))->toBeTrue();
    expect((bool) DB::scalar('SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user'))->toBeFalse();
    $device = ['id' => (string) Str::uuid(), 'church_id' => $church, 'membership_id' => $run['membership_id'], 'device_id' => (string) Str::uuid(), 'cursor' => 0, 'updated_at' => now()];
    expect(fn () => p21Scope($church, fn () => DB::table('device_cursors')->insert($device + ['receipt_coverage' => 'complete', 'receipt_coverage_since' => '2000-01-01 00:00:00+00'])))->toThrow(QueryException::class);
    expect(fn () => p21Scope($church, fn () => DB::table('device_cursors')->insert($device + ['receipt_coverage' => 'pruned', 'receipt_pruned_through' => '2000-01-01 00:00:00+00'])))->toThrow(QueryException::class);
    p21Scope($church, function () use ($device): void {
        expect(DB::table('device_cursors')->where('id', $device['id'])->exists())->toBeFalse();
        DB::table('device_cursors')->insert($device);
        DB::table('device_cursors')->where('id', $device['id'])->update(['cursor' => 10]);
        $row = DB::table('device_cursors')->where('id', $device['id'])->first();
        expect((int) $row->cursor)->toBe(10)->and($row->receipt_coverage)->toBe('unknown')->and($row->receipt_coverage_since)->toBeNull();
    });
});

it('RC-02 refuses runtime backdating of an existing complete coverage start', function (): void {
    [$church, $run] = p21Fixture();
    $since = '2026-10-01 00:00:00+00';
    // Hypothetical previously established evidence, fixture only. No admission protocol
    // or original-event acceptance is implemented or claimed by this privileged seed.
    DB::connection('pgsql_migration')->transaction(function () use ($run, $since): void {
        DB::connection('pgsql_migration')->statement('ALTER TABLE device_cursors DISABLE TRIGGER recovery_device_guard');
        DB::connection('pgsql_migration')->table('device_cursors')->where('device_id', $run['device_id'])->update(['receipt_coverage' => 'complete', 'receipt_coverage_since' => $since]);
        DB::connection('pgsql_migration')->statement('ALTER TABLE device_cursors ENABLE TRIGGER recovery_device_guard');
    });
    expect((bool) DB::scalar("SELECT has_table_privilege(current_user,'device_cursors','UPDATE')"))->toBeTrue();
    expect((bool) DB::scalar('SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user'))->toBeFalse();
    expect(fn () => p21Scope($church, fn () => DB::table('device_cursors')->where('device_id', $run['device_id'])->update(['receipt_coverage_since' => '2026-09-30 00:00:00+00'])))->toThrow(QueryException::class);
    p21Scope($church, function () use ($run, $since): void {
        DB::table('device_cursors')->where('device_id', $run['device_id'])->update(['cursor' => 9001]);
        $row = DB::table('device_cursors')->where('device_id', $run['device_id'])->first();
        expect((int) $row->cursor)->toBe(9001)->and($row->receipt_coverage)->toBe('complete');
        expect(strtotime($row->receipt_coverage_since))->toBe(strtotime($since));
    });
});

it('enforces forced RLS and restricted grants on every recovery table', function (): void {
    foreach (['sync_recovery_progress', 'offline_recovery_runs', 'offline_recovery_pages'] as $table) {
        $flags = DB::selectOne('SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname=?', [$table]);
        expect($flags->relrowsecurity)->toBeTrue()->and($flags->relforcerowsecurity)->toBeTrue();
        expect(DB::table($table)->count())->toBe(0);
        expect((bool) DB::scalar("SELECT has_table_privilege(current_user, ?, 'DELETE')", [$table]))->toBeFalse();
    }
    expect((bool) DB::scalar("SELECT has_table_privilege(current_user,'offline_recovery_runs','UPDATE')"))->toBeFalse();
    expect((bool) DB::scalar("SELECT has_function_privilege('public','transition_recovery_run(uuid,varchar,jsonb)','EXECUTE')"))->toBeFalse();
    expect((bool) DB::scalar('SELECT rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole FROM pg_roles WHERE rolname=current_user'))->toBeFalse();
});

it('denies foreign reads writes transitions and page references', function (): void {
    [$a, $run] = p21Fixture();
    [$b] = p21Fixture();
    p21Scope($b, function () use ($run): void {
        expect(DB::table('offline_recovery_runs')->where('id', $run['id'])->count())->toBe(0);
    });
    expect(fn () => p21Scope($b, fn () => p21Page($run)))->toThrow(QueryException::class);
    expect(fn () => p21Scope($b, fn () => p21Transition($run, ['state' => 'superseded'])))->toThrow(QueryException::class);
    $foreign = $run;
    $foreign['church_id'] = $b;
    expect(fn () => p21Scope($b, fn () => p21Page($foreign)))->toThrow(QueryException::class);
    expect(p21Scope($a, fn () => DB::table('offline_recovery_pages')->count()))->toBe(0);
});

it('atomically counts actual stored bytes and refuses page gaps and aggregate overflow', function (): void {
    [$church, $run] = p21Fixture(['max_stored_bytes' => 7]);
    p21Scope($church, fn () => p21Page($run));
    expect(fn () => p21Scope($church, fn () => p21Page($run, 'input', 2)))->toThrow(QueryException::class);
    expect(fn () => p21Scope($church, fn () => p21Page($run, 'output')))->toThrow(QueryException::class);
    $row = p21Scope($church, fn () => DB::table('offline_recovery_runs')->where('id', $run['id'])->first());
    expect($row->input_page_count)->toBe(1)->and((int) $row->stored_bytes)->toBe(4)->and($row->output_page_count)->toBe(0);
});

it('does not count an ignored duplicate insert as another page', function (): void {
    [$church, $run] = p21Fixture();
    p21Scope($church, function () use ($run): void {
        p21Page($run);
        $page = (array) DB::table('offline_recovery_pages')->first();
        DB::table('offline_recovery_pages')->insertOrIgnore($page);
        expect(DB::table('offline_recovery_runs')->value('input_page_count'))->toBe(1);
    });
});

it('requires complete nonnull sealing metadata and an issued cut', function (): void {
    [$church, $run] = p21Fixture();
    p21Scope($church, function () use ($run): void {
        p21Page($run);
        p21Page($run, 'output');
    });
    expect(fn () => p21Scope($church, fn () => p21Transition($run, ['state' => 'ready'])))->toThrow(QueryException::class);
    expect(fn () => p21Scope($church, fn () => p21Transition($run, array_replace(p21Ready(), ['snapshot_cursor' => 9000]))))->toThrow(QueryException::class);
    p21Scope($church, fn () => p21Transition($run, p21Ready()));
    expect(p21Scope($church, fn () => DB::table('offline_recovery_runs')->value('state')))->toBe('ready');
});

it('protects immutable pages sealed fields and lifecycle predecessor state', function (): void {
    [$church, $run] = p21Fixture();
    p21Scope($church, function () use ($run): void {
        p21Page($run);
        p21Page($run, 'output');
        p21Transition($run, p21Ready());
    });
    expect(fn () => p21Scope($church, fn () => DB::table('offline_recovery_pages')->update(['payload_ciphertext' => 'changed'])))->toThrow(QueryException::class);
    expect(fn () => p21Scope($church, fn () => p21Page($run, 'input', 1)))->toThrow(QueryException::class);
    expect(fn () => p21Scope($church, fn () => p21Transition($run, ['state' => 'client_confirmed', 'snapshot_cursor' => 10], 'ready')))->toThrow(QueryException::class);
    expect(fn () => p21Scope($church, fn () => p21Transition($run, ['state' => 'client_confirmed'])))->toThrow(QueryException::class);
    p21Scope($church, fn () => p21Transition($run, ['state' => 'client_confirmed'], 'ready'));
    expect(fn () => p21Scope($church, fn () => p21Transition($run, ['state' => 'collecting'], 'client_confirmed')))->toThrow(QueryException::class);
});

it('cleans only inactive terminal payloads and preserves run metadata and recovery holds', function (): void {
    [$church, $run] = p21Fixture();
    p21Scope($church, function () use ($run): void {
        p21Page($run);
        DB::table('device_cursors')->update(['active_recovery_id' => $run['id'], 'full_resync_required' => true]);
        p21Transition($run, ['state' => 'superseded']);
    });
    expect(fn () => p21Scope($church, fn () => DB::select('SELECT cleanup_recovery_pages(?::uuid)', [$run['id']])))->toThrow(QueryException::class);
    expect(fn () => MaintenanceScenario::run(fn () => p21Scope($church, fn () => DB::select('SELECT cleanup_recovery_pages(?::uuid)', [$run['id']]))))->toThrow(QueryException::class);
    p21Scope($church, function (): void {
        DB::table('device_cursors')->update(['active_recovery_id' => null]);
    });
    $purged = MaintenanceScenario::run(fn () => p21Scope($church, fn () => (int) DB::scalar('SELECT cleanup_recovery_pages(?::uuid)', [$run['id']])));
    expect($purged)->toBe(1);
    p21Scope($church, function (): void {
        expect(DB::table('offline_recovery_runs')->count())->toBe(1);
        expect(DB::table('device_cursors')->value('full_resync_required'))->toBeTrue();
    });
});

it('rejects partial applied evidence foreign generations and backwards progress', function (): void {
    [$church, $run] = p21Fixture();
    expect(fn () => p21Scope($church, fn () => DB::table('device_cursors')->update(['applied_cursor' => 1])))->toThrow(QueryException::class);
    expect(fn () => p21Scope($church, fn () => DB::table('sync_recovery_progress')->update(['feed_head' => 6])))->toThrow(QueryException::class);
    p21Scope($church, fn () => DB::table('sync_recovery_progress')->update(['pruned_through' => 5]));
    expect(fn () => p21Scope($church, fn () => DB::table('sync_recovery_progress')->update(['pruned_through' => null])))->toThrow(QueryException::class);
});

it('refuses automatic destructive rollback', function (): void {
    $migration = require database_path('migrations/2026_10_16_000001_create_recovery_foundations.php');
    expect(fn () => $migration->down())->toThrow(RuntimeException::class, 'Recovery evidence is preserved');
    expect(Schema::hasTable('offline_recovery_runs'))->toBeTrue();
});

it('migrates an existing baseline device without trusting its served cursor', function (): void {
    $paths = array_values(array_filter(glob(database_path('migrations/*.php')), fn ($path) => ! in_array(basename($path), ['2026_10_16_000001_create_recovery_foundations.php', '2026_10_19_000003_qualify_recovery_snapshots.php'], true)));
    expect(Artisan::call('migrate:fresh', ['--database' => 'pgsql_migration', '--force' => true, '--path' => $paths, '--realpath' => true]))->toBe(0);
    [, $church, $member] = ChurchScenario::owner();
    $device = (string) Str::uuid();
    DB::connection('pgsql_migration')->table('device_cursors')->insert(['id' => (string) Str::uuid(), 'church_id' => $church->id, 'membership_id' => $member->id, 'device_id' => $device, 'cursor' => 9000, 'updated_at' => now()]);
    expect(Artisan::call('migrate', ['--database' => 'pgsql_migration', '--force' => true, '--path' => 'database/migrations/2026_10_16_000001_create_recovery_foundations.php']))->toBe(0);
    $row = DB::connection('pgsql_migration')->table('device_cursors')->where('device_id', $device)->first();
    expect((int) $row->cursor)->toBe(9000)->and($row->applied_cursor)->toBeNull()->and($row->applied_generation)->toBeNull()
        ->and($row->receipt_coverage)->toBe('unknown')->and($row->receipt_coverage_since)->toBeNull();
    expect(DB::connection('pgsql_migration')->table('sync_recovery_progress')->count())->toBe(0);
    // Replay dependent additive snapshots only after the original foundation;
    // retain the historical upgrade assertions above and restore current schema.
    expect(Artisan::call('migrate', ['--database' => 'pgsql_migration', '--force' => true, '--path' => 'database/migrations/2026_10_19_000003_qualify_recovery_snapshots.php']))->toBe(0);
});

it('binds applied evidence to the sealed origin and prevents guessed receipt coverage', function (): void {
    [$church, $run] = p21Fixture();
    p21Scope($church, function () use ($run): void {
        p21Page($run);
        p21Page($run, 'output');
        p21Transition($run, p21Ready());
    });
    $evidence = ['applied_cursor' => 11, 'applied_generation' => $run['generation'], 'applied_coverage_epoch' => $run['coverage_epoch'], 'applied_scope_digest' => str_repeat('c', 64), 'applied_evidence_at' => now()];
    expect(fn () => p21Scope($church, fn () => DB::table('device_cursors')->update(array_replace($evidence, ['applied_coverage_epoch' => (string) Str::uuid()]))))->toThrow(QueryException::class);
    expect(fn () => p21Scope($church, fn () => DB::table('device_cursors')->update($evidence)))->toThrow(QueryException::class);
    p21Scope($church, fn () => DB::table('device_cursors')->update(['active_recovery_id' => $run['id']]));
    p21Scope($church, fn () => DB::table('device_cursors')->update($evidence));
    expect(fn () => p21Scope($church, fn () => DB::table('device_cursors')->update(['applied_cursor' => 10])))->toThrow(QueryException::class);
    expect(fn () => p21Scope($church, fn () => DB::table('device_cursors')->update(['receipt_coverage' => 'complete', 'receipt_coverage_since' => now()])))->toThrow(QueryException::class);
    p21Scope($church, function () use ($run): void {
        p21Transition($run, ['state' => 'superseded'], 'ready');
        DB::table('device_cursors')->update(['cursor' => 9001]);
        expect((int) DB::table('device_cursors')->value('applied_cursor'))->toBe(11);
    });
});

it('rejects mismatched actor binding oversized pages and excess item or page counts', function (): void {
    [$church, $run] = p21Fixture(['max_input_pages' => 1, 'max_items' => 1]);
    [, $other] = p21Fixture();
    $invalid = array_replace($run, ['id' => (string) Str::uuid(), 'request_id' => (string) Str::uuid(), 'generation' => (string) Str::uuid(), 'actor_id' => $other['actor_id']]);
    expect(fn () => p21Scope($church, fn () => DB::table('offline_recovery_runs')->insert($invalid)))->toThrow(QueryException::class);
    expect(fn () => p21Scope($church, fn () => p21Page($run, payload: str_repeat('x', 2097153))))->toThrow(QueryException::class);
    p21Scope($church, fn () => p21Page($run));
    expect(fn () => p21Scope($church, fn () => p21Page($run, 'input', 1)))->toThrow(QueryException::class);
    expect(fn () => p21Scope($church, fn () => p21Page($run, 'output')))->toThrow(QueryException::class);
});

it('refuses new applied credit from an inactive or terminal origin', function (string $condition, bool $alreadyApplied): void {
    [$church, $run] = p21Fixture(in_array($condition, ['expired', 'deadline'], true) ? ['expires_at' => now()->addSeconds(3)] : []);
    $evidence = ['applied_cursor' => 11, 'applied_generation' => $run['generation'], 'applied_coverage_epoch' => $run['coverage_epoch'], 'applied_scope_digest' => str_repeat('c', 64), 'applied_evidence_at' => now()];
    p21Scope($church, function () use ($run, $alreadyApplied, $evidence): void {
        p21Page($run);
        p21Page($run, 'output');
        p21Transition($run, p21Ready());
        DB::table('device_cursors')->update(['active_recovery_id' => $run['id']]);
        if ($alreadyApplied) {
            DB::table('device_cursors')->update($evidence);
        }
    });
    if ($condition === 'inactive') {
        p21Scope($church, fn () => DB::table('device_cursors')->update(['active_recovery_id' => null]));
    } elseif ($condition === 'other-generation') {
        $next = array_replace($run, ['id' => (string) Str::uuid(), 'generation' => (string) Str::uuid(), 'request_id' => (string) Str::uuid(), 'local_generation_id' => (string) Str::uuid()]);
        p21Scope($church, function () use ($next): void {
            DB::table('offline_recovery_runs')->insert($next);
            DB::table('device_cursors')->update(['active_recovery_id' => $next['id']]);
        });
    } elseif ($condition === 'superseded') {
        p21Scope($church, fn () => p21Transition($run, ['state' => 'superseded'], 'ready'));
    } else {
        // Wait for this run's real deadline, not an enlarged assertion timeout or a mocked clock.
        p21Scope($church, fn () => DB::select('SELECT pg_sleep(GREATEST(0, EXTRACT(EPOCH FROM (expires_at-clock_timestamp()))) + 0.01) FROM offline_recovery_runs WHERE id=?', [$run['id']]));
        if ($condition === 'expired') {
            p21Scope($church, fn () => p21Transition($run, ['state' => 'expired'], 'ready'));
        }
    }
    p21Scope($church, fn () => DB::table('sync_recovery_progress')->update(['feed_head' => 12]));
    expect(fn () => p21Scope($church, fn () => DB::table('device_cursors')->update(array_replace($evidence, ['applied_cursor' => 12]))))->toThrow(QueryException::class);
    p21Scope($church, function () use ($alreadyApplied): void {
        DB::table('device_cursors')->update(['cursor' => 9001]);
        $row = DB::table('device_cursors')->first();
        expect($row->applied_cursor === null ? null : (int) $row->applied_cursor)->toBe($alreadyApplied ? 11 : null);
        expect($row->receipt_coverage)->toBe('unknown');
    });
})->with(['inactive', 'other-generation', 'superseded', 'expired', 'deadline'])->with([false, true]);

it('rejects cross-device and cross-tenant applied origins while accepting the active authorized origin', function (): void {
    [$church, $run] = p21Fixture();
    [$foreignChurch, $foreignRun] = p21Fixture();
    foreach ([[$church, $run], [$foreignChurch, $foreignRun]] as [$scope, $origin]) {
        p21Scope($scope, function () use ($origin): void {
            p21Page($origin);
            p21Page($origin, 'output');
            p21Transition($origin, p21Ready());
        });
    }
    $otherDevice = (string) Str::uuid();
    DB::connection('pgsql_migration')->table('device_cursors')->insert(['id' => (string) Str::uuid(), 'church_id' => $church, 'membership_id' => $run['membership_id'], 'device_id' => $otherDevice, 'cursor' => 0, 'updated_at' => now()]);
    $evidence = ['applied_cursor' => 11, 'applied_generation' => $run['generation'], 'applied_coverage_epoch' => $run['coverage_epoch'], 'applied_scope_digest' => str_repeat('c', 64), 'applied_evidence_at' => now()];
    expect(fn () => p21Scope($church, fn () => DB::table('device_cursors')->where('device_id', $otherDevice)->update(['active_recovery_id' => $run['id']])))->toThrow(QueryException::class);
    expect(fn () => p21Scope($church, fn () => DB::table('device_cursors')->where('device_id', $otherDevice)->update($evidence)))->toThrow(QueryException::class);
    expect(fn () => p21Scope($church, fn () => DB::table('device_cursors')->where('device_id', $run['device_id'])->update(['active_recovery_id' => $foreignRun['id']])))->toThrow(QueryException::class);
    expect(fn () => p21Scope($church, fn () => DB::table('device_cursors')->where('device_id', $run['device_id'])->update(array_replace($evidence, ['applied_generation' => $foreignRun['generation'], 'applied_coverage_epoch' => $foreignRun['coverage_epoch']]))))->toThrow(QueryException::class);
    p21Scope($church, function () use ($run, $evidence, $otherDevice): void {
        DB::table('device_cursors')->where('device_id', $run['device_id'])->update(['active_recovery_id' => $run['id']]);
        DB::table('device_cursors')->where('device_id', $run['device_id'])->update($evidence);
        p21Transition($run, ['state' => 'client_confirmed'], 'ready');
        DB::table('sync_recovery_progress')->update(['feed_head' => 12]);
        DB::table('device_cursors')->where('device_id', $run['device_id'])->update(['applied_cursor' => 12]);
        expect((int) DB::table('device_cursors')->where('device_id', $run['device_id'])->value('applied_cursor'))->toBe(12);
        expect(DB::table('device_cursors')->where('device_id', $otherDevice)->value('applied_cursor'))->toBeNull();
    });
});
