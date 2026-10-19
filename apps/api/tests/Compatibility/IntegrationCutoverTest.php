<?php

use App\Actions\Applications\ApproveChurchApplication;
use App\Domain\Attendance\PublishAttendanceChange;
use App\Domain\Audit\AuditEntry;
use App\Domain\Audit\AuditWriter;
use App\Domain\Sync\ChurchCoordination;
use App\Domain\Sync\CoordinatedChangePublisher;
use App\Models\AttendanceSession;
use App\Models\ChurchApplication;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\Support\AuthorityScenario as A;
use Tests\Support\ChurchScenario;
use Tests\Support\IntegrationScenario as I;
use Tests\Support\PostgresTestDatabase;
use Tests\TestCase;

uses(TestCase::class);
beforeEach(function (): void {
    A::guard();
    PostgresTestDatabase::refresh();
});

afterEach(function (): void {
    I::resetMode();
    DB::disconnect('pgsql');
    DB::disconnect('pgsql_migration');
});

it('does not initialize existing recovery progress or activate publication in a migration', function (): void {
    expect(DB::scalar("SELECT to_regclass('public.sync_publication_control') IS NOT NULL"))->toBeTrue();
    expect(DB::connection('pgsql_migration')->table('sync_recovery_progress')->count())->toBe(0);
});

it('refuses runtime activation authority', function (): void {
    try {
        DB::select('SELECT public.activate_coordinated_publication(?::uuid)', [(string) Str::uuid()]);
        throw new RuntimeException('Runtime unexpectedly activated publication');
    } catch (QueryException $exception) {
        expect($exception->errorInfo[0])->toBe('42501');
    }
});

it('refuses owner cutover while database admission remains open', function (): void {
    try {
        DB::connection('pgsql_migration')->select('SELECT public.activate_coordinated_publication(?::uuid)', [(string) Str::uuid()]);
        throw new RuntimeException('Unsealed database unexpectedly activated');
    } catch (QueryException $exception) {
        expect($exception->errorInfo[0])->toBe('55000');
    }
    expect(DB::connection('pgsql_migration')->table('sync_recovery_progress')->count())->toBe(0);
});

it('seals and drains actual runtime sessions before atomic privilege cutover', function (): void {
    [, $church] = ChurchScenario::owner();
    $result = I::activate();
    expect($result['churches'])->toBe(1)->and($result['history_coverage'])->toBe('unknown');
    expect(DB::scalar("SELECT has_function_privilege(current_user,?,'EXECUTE')", [I::APPEND]))->toBeTrue()
        ->and(DB::scalar("SELECT has_table_privilege(current_user,'change_feed','INSERT')"))->toBeFalse()
        ->and(DB::scalar("SELECT has_sequence_privilege(current_user,'change_feed_sequence_seq','USAGE')"))->toBeFalse()
        ->and(DB::scalar("SELECT has_column_privilege(current_user,'sync_recovery_progress','feed_head','UPDATE')"))->toBeFalse();
    $progress = DB::connection('pgsql_migration')->table('sync_recovery_progress')->where('church_id', $church->id)->first();
    expect($progress->pruned_through)->toBeNull()->and((int) $progress->feed_head)->toBe(0);
});

it('prevents a drained old application from reconnecting with its old runtime credential', function (): void {
    $oldPassword = config('database.connections.pgsql.password');
    I::activate();
    $connected = false;
    try {
        $old = new PDO('pgsql:host=127.0.0.1;port=5432;dbname='.getenv('PC_DATABASE'), getenv('PC_RUNTIME'), $oldPassword, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $connected = true;
        $old = null;
    } catch (PDOException) {
        // No credential or exception text is persisted.
    }
    expect($connected)->toBeFalse();
});

it('does not clear recovery or issue a replacement lease from active legacy device endpoints', function (): void {
    [$church] = I::ownerFixture($this);
    $device = (string) Str::uuid();
    $this->getJson('/api/offline/bootstrap?device_id='.$device)->assertOk();
    I::activate();
    $db = DB::connection('pgsql_migration');
    $beforeCursors = json_encode($db->table('device_cursors')->get());
    $beforeLeases = json_encode($db->table('offline_authorizations')->get());
    $this->getJson('/api/offline/bootstrap?device_id='.$device)->assertStatus(409)->assertJsonPath('code', 'full_bootstrap_required');
    foreach (['0', '1', '999999'] as $cursor) {
        $this->withHeader('X-Device-Id', $device)->getJson('/api/sync/pull?cursor='.$cursor)->assertStatus(409)->assertJsonPath('code', 'full_bootstrap_required');
    }
    $this->postJson('/api/sync/push', ['device_id' => $device, 'batch_id' => (string) Str::uuid(), 'events' => [[
        'client_event_id' => (string) Str::uuid(), 'entity_id' => (string) Str::uuid(), 'action' => 'attendance.draft_created',
        'base_version' => 0, 'occurred_at' => now()->toISOString(), 'payload' => [],
    ]]])->assertStatus(409)->assertJsonPath('code', 'full_bootstrap_required');
    expect(json_encode($db->table('device_cursors')->get()))->toBe($beforeCursors)
        ->and(json_encode($db->table('offline_authorizations')->get()))->toBe($beforeLeases)
        ->and($db->table('sync_events')->count())->toBe(0);
});

it('initializes genuinely new church metadata atomically with Owner provisioning and its required audit', function (): void {
    I::activate();
    Mail::fake();
    $user = User::factory()->create();
    $application = ChurchApplication::create(['user_id' => $user->id, 'status' => 'pending', 'church_name' => 'Synthetic Genesis', 'city' => 'Synthetic City', 'timezone' => 'Asia/Manila']);
    $actor = (string) Str::uuid();
    $correlation = (string) Str::uuid();
    $approved = app(ApproveChurchApplication::class)->handle($application->id, $actor, $correlation);
    $repeat = app(ApproveChurchApplication::class)->handle($application->id, $actor, $correlation);
    $db = DB::connection('pgsql_migration');
    $progress = $db->table('sync_recovery_progress')->where('church_id', $approved->church_id)->first();
    expect($repeat->church_id)->toBe($approved->church_id)
        ->and($db->table('church_memberships')->where('church_id', $approved->church_id)->where('role', 'owner')->where('status', 'active')->count())->toBe(1)
        ->and((int) $progress->feed_head)->toBe(0)->and((int) $progress->pruned_through)->toBe(0)
        ->and($progress->history_baselined_at)->not->toBeNull()->and(Str::isUuid($progress->coverage_epoch))->toBeTrue()
        ->and($db->table('device_cursors')->count())->toBe(0)
        ->and($db->table('audit_events')->where('action', 'application.approved')->where('correlation_id', $correlation)->count())->toBe(1);
});

it('rolls back new church Owner genesis and application outcome when the actual required audit writer fails', function (): void {
    I::activate();
    Mail::fake();
    $user = User::factory()->create();
    $application = ChurchApplication::create(['user_id' => $user->id, 'status' => 'pending', 'church_name' => 'Synthetic Rollback', 'city' => 'Synthetic City', 'timezone' => 'Asia/Manila']);
    $this->instance(AuditWriter::class, new class extends AuditWriter
    {
        public function record(AuditEntry $event): void
        {
            throw new RuntimeException('isolated required audit failure');
        }
    });
    expect(fn () => app(ApproveChurchApplication::class)->handle($application->id, (string) Str::uuid(), (string) Str::uuid()))->toThrow(RuntimeException::class);
    $db = DB::connection('pgsql_migration');
    expect($db->table('churches')->count())->toBe(0)->and($db->table('church_memberships')->count())->toBe(0)
        ->and($db->table('sync_recovery_progress')->count())->toBe(0)
        ->and($application->fresh()->status->value)->toBe('pending');
});

it('never silently recreates a missing or mismatched church epoch and refuses adverse sequence caching', function (): void {
    [$church,,,$request,$ministry] = I::ownerFixture($this);
    I::activate();
    $db = DB::connection('pgsql_migration');
    $db->statement('ALTER SEQUENCE public.change_feed_sequence_seq CACHE 8');
    expect(fn () => app(TenantContext::class)->run($church->id, fn () => app(ChurchCoordination::class)->run($request, function () use ($church, $ministry): void {
        $session = AttendanceSession::create(['church_id' => $church->id, 'ministry_id' => $ministry, 'attendance_date' => now()->toDateString(), 'status' => 'draft', 'version' => 1]);
        app(PublishAttendanceChange::class)->handle($session);
    })))->toThrow(QueryException::class);
    expect($db->table('change_feed')->count())->toBe(0)->and($db->table('attendance_sessions')->count())->toBe(0);
    $db->statement('ALTER SEQUENCE public.change_feed_sequence_seq CACHE 1');
    $epoch = $db->table('sync_recovery_progress')->where('church_id', $church->id)->value('coverage_epoch');
    $change = ['ministry_id' => $ministry, 'target_membership_id' => null, 'entity_type' => 'attendance_session', 'entity_id' => (string) Str::uuid(), 'entity_version' => 1, 'action' => 'upsert', 'payload_json' => []];
    try {
        app(TenantContext::class)->run($church->id, fn () => app(ChurchCoordination::class)->run($request, fn ($m, $u, $context) => app(CoordinatedChangePublisher::class)->append($context, (string) Str::uuid(), $change)));
        throw new RuntimeException('Mismatched epoch accepted');
    } catch (QueryException $error) {
        expect($error->errorInfo[0])->toBe('55000');
    }
    expect($db->table('sync_recovery_progress')->where('church_id', $church->id)->value('coverage_epoch'))->toBe($epoch);
});

it('expands catalog transaction IDs without losing the PostgreSQL wraparound epoch', function (): void {
    $db = DB::connection('pgsql_migration');
    expect($db->scalar("SELECT public.publication_full_xid('5'::xid,'4294967316'::xid8)::text"))->toBe('4294967301')
        ->and($db->scalar("SELECT public.publication_full_xid('4294967290'::xid,'4294967316'::xid8)::text"))->toBe('4294967290')
        ->and($db->scalar("SELECT public.publication_full_xid('100'::xid,'10'::xid8)::text"))->toBeNull();
});

it('refuses a real prepared transaction even after live connections drain', function (): void {
    $gid = 'pde_'.str_replace('-', '', Str::uuid()->toString());
    $pdo = new PDO('pgsql:host=127.0.0.1;port=5432;dbname='.getenv('PC_DATABASE'), getenv('PC_SETUP'), getenv('DB_MIGRATION_PASSWORD'), [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $pdo->beginTransaction();
    $pdo->exec("INSERT INTO public.operational_events(id,event_type,severity,correlation_id,metadata_json,occurred_at) VALUES(gen_random_uuid(),'api.error','error',gen_random_uuid(),'{}',clock_timestamp())");
    $pdo->exec("PREPARE TRANSACTION '".$gid."'");
    $pdo = null;
    try {
        expect(DB::connection('pgsql_migration')->scalar('SELECT count(*) FROM pg_prepared_xacts WHERE gid=?', [$gid]))->toBe(1);
        try {
            I::activate();
            throw new RuntimeException('Prepared writer accepted');
        } catch (QueryException $error) {
            expect($error->errorInfo[0])->toBe('55000');
        }
        expect(DB::connection('pgsql_migration')->table('sync_recovery_progress')->count())->toBe(0);
    } finally {
        I::reopen();
        DB::connection('pgsql_migration')->statement("ROLLBACK PREPARED '".$gid."'");
    }
    expect(DB::connection('pgsql_migration')->table('operational_events')->count())->toBe(0);
});

it('refuses additional direct writer grants instead of silently withdrawing an unknown role', function (): void {
    $role = 'pc_bde_extra_'.bin2hex(random_bytes(4));
    $db = DB::connection('pgsql_migration');
    $db->statement('CREATE ROLE "'.$role.'" NOLOGIN');
    $db->statement('GRANT INSERT ON public.change_feed TO "'.$role.'"');
    try {
        expect(fn () => I::activate())->toThrow(QueryException::class);
        expect($db->table('sync_recovery_progress')->count())->toBe(0)
            ->and($db->scalar("SELECT has_table_privilege(?,'change_feed','INSERT')", [$role]))->toBeTrue();
    } finally {
        $db->statement('REVOKE INSERT ON public.change_feed FROM "'.$role.'"');
    }
});

it('rolls metadata activation and all privilege changes back on a real required SQL audit failure', function (): void {
    [, $church] = ChurchScenario::owner();
    $db = DB::connection('pgsql_migration');
    $db->unprepared("CREATE OR REPLACE FUNCTION public.pde_fail_cutover_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='sync.publication.activated' THEN RAISE EXCEPTION 'isolated required cutover audit'; END IF; RETURN NEW; END $$");
    $db->statement('CREATE TRIGGER pde_fail_cutover_audit BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.pde_fail_cutover_audit()');
    try {
        expect(fn () => I::activate())->toThrow(QueryException::class);
        expect($db->table('sync_recovery_progress')->count())->toBe(0)
            ->and($db->table('sync_publication_control')->where('active', true)->count())->toBe(0)
            ->and($db->scalar("SELECT has_function_privilege(?,?,'EXECUTE')", [getenv('PC_RUNTIME'), I::APPEND]))->toBeFalse()
            ->and($db->scalar("SELECT has_table_privilege(?,'change_feed','INSERT')", [getenv('PC_RUNTIME')]))->toBeTrue();
    } finally {
        $db->unprepared('DROP FUNCTION public.pde_fail_cutover_audit() CASCADE');
    }
});

it('keeps private seal evidence and owner-only seal capture inaccessible to ordinary runtime', function (): void {
    foreach (['SELECT legacy_verifier_digest FROM public.sync_publication_control', 'SELECT public.record_publication_admission_seal()'] as $sql) {
        try {
            DB::select($sql);
            throw new RuntimeException('Private operational authority exposed');
        } catch (QueryException $error) {
            expect($error->errorInfo[0])->toBe('42501');
        }
    }
});

it('refuses unqualified column writer grants rather than leaving an alternate cutover path', function (bool $runtime, bool $tableUpdate): void {
    $role = $runtime ? getenv('PC_RUNTIME') : 'pc_bde_column_'.bin2hex(random_bytes(4));
    $db = DB::connection('pgsql_migration');
    if (! $runtime) {
        $db->statement('CREATE ROLE "'.$role.'" NOLOGIN');
    }
    $privilege = $tableUpdate ? 'UPDATE' : 'INSERT(payload_json)';
    $db->statement('GRANT '.$privilege.' ON public.change_feed TO "'.$role.'"');
    try {
        expect(fn () => I::activate())->toThrow(QueryException::class);
        expect($db->table('sync_recovery_progress')->count())->toBe(0);
    } finally {
        $db->statement('REVOKE '.$privilege.' ON public.change_feed FROM "'.$role.'"');
    }
})->with([[false, false], [true, false], [true, true]]);

it('refuses a missing qualified church baseline without silently rebuilding it', function (): void {
    [$church, , , $request, $ministry] = I::ownerFixture($this);
    I::activate();
    $db = DB::connection('pgsql_migration');
    $db->table('sync_recovery_progress')->where('church_id', $church->id)->delete();
    expect(fn () => app(TenantContext::class)->run($church->id, fn () => app(ChurchCoordination::class)->run($request, function () use ($church, $ministry): void {
        $session = AttendanceSession::create(['church_id' => $church->id, 'ministry_id' => $ministry, 'attendance_date' => now()->toDateString(), 'status' => 'draft', 'version' => 1]);
        app(PublishAttendanceChange::class)->handle($session);
    })))->toThrow(LogicException::class);
    expect($db->table('sync_recovery_progress')->count())->toBe(0)
        ->and($db->table('attendance_sessions')->count())->toBe(0)
        ->and($db->table('change_feed')->count())->toBe(0);
});
