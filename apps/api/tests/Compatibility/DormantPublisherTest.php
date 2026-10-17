<?php

use App\Actions\Memberships\ManageTeachers;
use App\Domain\Attendance\PublishAttendanceChange;
use App\Domain\Sync\ChurchCoordination;
use App\Domain\Sync\CoordinatedChangePublisher;
use App\Models\AttendanceSession;
use App\Models\ChangeFeedEntry;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\PostgresTestDatabase;
use Tests\Support\PublisherScenario as P;
use Tests\TestCase;

require_once __DIR__.'/../Support/coordinated-publisher-worker.php';
uses(TestCase::class);
beforeEach(function (): void {
    P::guard();
    PostgresTestDatabase::refresh();
});
afterEach(fn () => P::cleanup());

it('constructs a dormant SQL boundary without granting ordinary runtime execution', function (): void {
    expect(DB::scalar('SELECT to_regprocedure(?) IS NOT NULL', [P::SIGNATURE]))->toBeTrue();
    expect(DB::scalar("SELECT has_function_privilege(current_user, ?, 'EXECUTE')", [P::SIGNATURE]))->toBeFalse();
    expect(DB::scalar("SELECT has_table_privilege(current_user,'change_feed','INSERT')"))->toBeTrue();
    expect(DB::scalar("SELECT has_sequence_privilege(current_user,'change_feed_sequence_seq','USAGE')"))->toBeTrue();
    expect(DB::connection('pgsql_migration')->table('sync_recovery_progress')->count())->toBe(0);
});

it('requires a live callback-bound context rather than a global coordination flag', function (): void {
    [$church, , , $request] = P::fixture($this);
    $captured = null;
    app(TenantContext::class)->run($church->id, function () use ($request, &$captured): void {
        app(ChurchCoordination::class)->run($request, function ($member, $actor, $context) use (&$captured): void {
            $captured = $context;
            $context->assertUsable();
        });
    });
    expect($captured)->not->toBeNull();
    expect(fn () => $captured->assertUsable())->toThrow(LogicException::class);
});

it('commits exactly the supported payload together with its feed head', function (): void {
    [$church, , $member, $request, $ministry] = P::fixture($this);
    $epoch = P::initialize($church->id);
    P::grantForProof();
    $change = P::change($ministry, $member->id);
    $sequence = app(TenantContext::class)->run($church->id, fn () => app(ChurchCoordination::class)->run($request,
        fn ($member, $actor, $context) => app(CoordinatedChangePublisher::class)->append($context, $epoch, $change)));
    $db = DB::connection('pgsql_migration');
    $row = (array) $db->table('change_feed')->sole();
    $row['payload_json'] = json_decode($row['payload_json'], true, 512, JSON_THROW_ON_ERROR);
    foreach ($change as $key => $value) {
        expect($row[$key])->toBe($value);
    }
    expect((int) $row['sequence'])->toBe($sequence);
    expect((int) $db->table('sync_recovery_progress')->value('feed_head'))->toBe($sequence);
    expect($db->table('sync_recovery_progress')->value('pruned_through'))->toBeNull();
});

it('refuses missing or unqualified metadata without fabricating progress', function (string $kind): void {
    [$church, , $member, $request, $ministry] = P::fixture($this);
    $epoch = $kind === 'missing' ? (string) Str::uuid() : P::initialize($church->id, $kind !== 'unqualified');
    if ($kind === 'epoch') {
        $epoch = (string) Str::uuid();
    }
    P::grantForProof();
    expect(fn () => app(TenantContext::class)->run($church->id, fn () => app(ChurchCoordination::class)->run($request,
        fn ($m, $a, $c) => app(CoordinatedChangePublisher::class)->append($c, $epoch, P::change($ministry, $member->id)))))->toThrow(QueryException::class);
    expect(DB::connection('pgsql_migration')->table('change_feed')->count())->toBe(0);
})->with(['missing', 'unqualified', 'epoch']);

it('preserves forced RLS fixed search path and owner-only dormant execution', function (): void {
    $db = DB::connection('pgsql_migration');
    $routine = $db->selectOne('SELECT prosecdef,proconfig,proacl::text AS acl FROM pg_proc WHERE oid=?::regprocedure', [P::SIGNATURE]);
    expect($routine->prosecdef)->toBeTrue()->and($routine->proconfig)->toBe('{search_path=pg_catalog}');
    expect((int) $db->scalar('SELECT count(*) FROM pg_proc p, LATERAL aclexplode(p.proacl) a WHERE p.oid=?::regprocedure AND a.grantee<>p.proowner', [P::SIGNATURE]))->toBe(0);
    foreach (['change_feed', 'sync_recovery_progress'] as $table) {
        $flags = $db->selectOne('SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid=?::regclass', [$table]);
        expect($flags->relrowsecurity)->toBeTrue()->and($flags->relforcerowsecurity)->toBeTrue();
    }
    $role = $db->selectOne('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=?', [getenv('PA_RUNTIME')]);
    expect($role->rolsuper)->toBeFalse()->and($role->rolbypassrls)->toBeFalse();
});

it('actually denies SQL execution yet preserves direct legacy publication', function (): void {
    [$church, , $member, , $ministry] = P::fixture($this);
    $epoch = P::initialize($church->id);
    expect(fn () => app(TenantContext::class)->run($church->id, fn () => P::sql(P::values($church->id, $epoch, P::change($ministry, $member->id)))))
        ->toThrow(QueryException::class, '42501');
    app(TenantContext::class)->run($church->id, fn () => ChangeFeedEntry::create(['church_id' => $church->id, ...P::change($ministry, $member->id)]));
    expect(DB::connection('pgsql_migration')->table('change_feed')->count())->toBe(1);
    expect((int) DB::connection('pgsql_migration')->table('sync_recovery_progress')->value('feed_head'))->toBe(0);
});

it('refuses SQL scope transaction field and cross-tenant bypass attempts', function (string $case): void {
    [$church, $actor, $member, , $ministry] = P::fixture($this);
    [$other, , $otherMember, , $otherMinistry] = P::fixture($this);
    $this->actingAs($actor);
    $epoch = P::initialize($church->id);
    P::grantForProof();
    expect(fn () => app(TenantContext::class)->run($church->id, function () use ($case, $church, $other, $epoch, $member, $otherMember, $ministry, $otherMinistry): void {
        $values = P::values($church->id, $epoch, P::change($ministry, $member->id));
        match ($case) {
            'church' => $values[0] = $other->id,
            'scope' => DB::statement("SELECT set_config('app.current_church_id','',true)"),
            'transaction' => $values[2] = '0',
            'missing-transaction' => $values[2] = null,
            'ministry' => [$values[3] = $otherMinistry, $values[9] = json_encode(['ministry_id' => $otherMinistry], JSON_THROW_ON_ERROR)],
            'member' => $values[4] = $otherMember->id,
            'entity' => $values[5] = 'new_entity',
            'action' => $values[8] = 'upsert',
            'version' => $values[7] = 0,
            'payload' => $values[9] = '[]',
            'required' => $values[6] = null,
        };
        // A caller-controlled marker conveys no additional authority.
        DB::statement("SELECT set_config('app.coordinated','true',true)");
        P::sql($values);
    }))->toThrow(QueryException::class);
    expect(DB::connection('pgsql_migration')->table('change_feed')->count())->toBe(0);
    expect((int) DB::connection('pgsql_migration')->table('sync_recovery_progress')->value('feed_head'))->toBe(0);
})->with(['church', 'scope', 'transaction', 'missing-transaction', 'ministry', 'member', 'entity', 'action', 'version', 'payload', 'required']);

it('rolls domain feed and head back at each allocation insert and advancement failure boundary', function (string $phase): void {
    [$church, , $member, $request, $ministry] = P::fixture($this);
    $epoch = P::initialize($church->id);
    P::grantForProof();
    $db = DB::connection('pgsql_migration');
    $original = $db->table('ministries')->where('id', $ministry)->value('name');
    $table = $phase === 'head' ? 'sync_recovery_progress' : 'change_feed';
    $timing = $phase === 'allocated' ? 'BEFORE INSERT' : ($phase === 'inserted' ? 'AFTER INSERT' : 'AFTER UPDATE');
    $db->unprepared("CREATE FUNCTION public.proof_publication_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Deliberate publication boundary failure'; END $$;
        CREATE TRIGGER proof_publication_fail {$timing} ON public.{$table} FOR EACH ROW EXECUTE FUNCTION public.proof_publication_fail()");
    try {
        expect(fn () => app(TenantContext::class)->run($church->id, fn () => app(ChurchCoordination::class)->run($request,
            function ($m, $a, $c) use ($ministry, $epoch, $member): void {
                DB::table('ministries')->where('id', $ministry)->update(['name' => 'Must roll back']);
                app(CoordinatedChangePublisher::class)->append($c, $epoch, P::change($ministry, $member->id));
            })))->toThrow(QueryException::class, 'Deliberate publication boundary failure');
        expect($db->table('ministries')->where('id', $ministry)->value('name'))->toBe($original);
        expect($db->table('change_feed')->count())->toBe(0);
        expect((int) $db->table('sync_recovery_progress')->value('feed_head'))->toBe(0);
        expect((int) $db->scalar('SELECT last_value FROM change_feed_sequence_seq'))->toBeGreaterThan(0);
    } finally {
        $db->unprepared("DROP TRIGGER proof_publication_fail ON public.{$table}; DROP FUNCTION public.proof_publication_fail()");
    }
})->with(['allocated', 'inserted', 'head']);

it('preserves gaps and atomically commits domain feed and head in the outer transaction', function (): void {
    [$church, , $member, $request, $ministry] = P::fixture($this);
    $epoch = P::initialize($church->id);
    P::grantForProof();
    expect(fn () => app(TenantContext::class)->run($church->id, fn () => app(ChurchCoordination::class)->run($request,
        function ($m, $a, $c) use ($epoch, $ministry, $member): void {
            app(CoordinatedChangePublisher::class)->append($c, $epoch, P::change($ministry, $member->id));
            throw new RuntimeException('Deliberate outer failure');
        })))->toThrow(RuntimeException::class, 'Deliberate outer failure');
    $sequence = app(TenantContext::class)->run($church->id, fn () => app(ChurchCoordination::class)->run($request,
        function ($m, $a, $c) use ($epoch, $ministry, $member): int {
            DB::table('ministries')->where('id', $ministry)->update(['name' => 'Atomic domain result']);

            return app(CoordinatedChangePublisher::class)->append($c, $epoch, P::change($ministry, $member->id));
        }));
    $db = DB::connection('pgsql_migration');
    expect($sequence)->toBeGreaterThan(1);
    expect($db->table('ministries')->where('id', $ministry)->value('name'))->toBe('Atomic domain result');
    expect((int) $db->table('change_feed')->value('sequence'))->toBe($sequence);
    expect((int) $db->table('sync_recovery_progress')->value('feed_head'))->toBe($sequence);
    expect($db->table('sync_recovery_progress')->value('pruned_through'))->toBeNull();
});

it('examines adverse cache ordering without resetting a sequence and refuses cached publication', function (): void {
    [$church, , $member, $request, $ministry] = P::fixture($this);
    $epoch = P::initialize($church->id);
    P::grantForProof();
    $db = DB::connection('pgsql_migration');
    $db->statement('CREATE SEQUENCE proof_adverse_sequence CACHE 8');
    $db->statement('GRANT USAGE ON SEQUENCE proof_adverse_sequence TO "'.getenv('PA_RUNTIME').'"');
    // Independent backend caches: first backend reserves1..8, second reserves9..16.
    $one = (int) DB::scalar("SELECT nextval('proof_adverse_sequence')");
    $two = (int) $db->scalar("SELECT nextval('proof_adverse_sequence')");
    $three = (int) DB::scalar("SELECT nextval('proof_adverse_sequence')");
    expect($one)->toBeLessThan($two)->and($three)->toBeLessThan($two)->and($three)->toBeGreaterThan($one);
    $db->statement('ALTER SEQUENCE change_feed_sequence_seq CACHE 8');
    try {
        expect(fn () => app(TenantContext::class)->run($church->id, fn () => app(ChurchCoordination::class)->run($request,
            fn ($m, $a, $c) => app(CoordinatedChangePublisher::class)->append($c, $epoch, P::change($ministry, $member->id)))))->toThrow(QueryException::class, 'sequence cache one');
        expect($db->table('change_feed')->count())->toBe(0);
    } finally {
        // Restore configuration only. No setval, RESTART, or reset of any sequence.
        $db->statement('ALTER SEQUENCE change_feed_sequence_seq CACHE 1');
        $db->statement('DROP SEQUENCE proof_adverse_sequence');
    }
});

it('retains the actual existing attendance and assignment producer representations', function (string $kind): void {
    [$church, $actor, $member, $request, $ministry] = P::fixture($this);
    $epoch = P::initialize($church->id);
    P::grantForProof();
    app(TenantContext::class)->run($church->id, function () use ($kind, $church, $ministry, $member, $actor): void {
        if ($kind === 'attendance') {
            $session = new AttendanceSession;
            $session->forceFill(['id' => (string) Str::uuid(), 'church_id' => $church->id,
                'ministry_id' => $ministry, 'attendance_date' => '2026-10-17', 'status' => 'draft', 'version' => 1]);
            app(PublishAttendanceChange::class)->handle($session);
        } else {
            DB::table('teacher_ministry_assignments')->insert(['id' => (string) Str::uuid(), 'church_id' => $church->id,
                'ministry_id' => $ministry, 'membership_id' => $member->id, 'assigned_by' => $actor->id, 'created_at' => now(), 'updated_at' => now()]);
            app(ManageTeachers::class)->assign($member, [], $actor->id);
        }
    });
    $legacy = DB::connection('pgsql_migration')->table('change_feed')->sole();
    $change = collect((array) $legacy)->only(['ministry_id', 'target_membership_id', 'entity_type', 'entity_id', 'entity_version', 'action', 'payload_json'])->all();
    $change['payload_json'] = json_decode($change['payload_json'], true, 512, JSON_THROW_ON_ERROR);
    $sequence = app(TenantContext::class)->run($church->id, fn () => app(ChurchCoordination::class)->run($request,
        fn ($m, $a, $c) => app(CoordinatedChangePublisher::class)->append($c, $epoch, $change)));
    $new = (array) DB::connection('pgsql_migration')->table('change_feed')->where('sequence', $sequence)->sole();
    $new['payload_json'] = json_decode($new['payload_json'], true, 512, JSON_THROW_ON_ERROR);
    foreach ($change as $key => $value) {
        expect($new[$key])->toBe($value);
    }
})->with(['attendance', 'assignment']);

it('rolls back a nested publication savepoint while retaining the primary gate and earlier publication', function (): void {
    [$church, , $member, $request, $ministry] = P::fixture($this);
    $epoch = P::initialize($church->id);
    P::grantForProof();
    $last = app(TenantContext::class)->run($church->id, fn () => app(ChurchCoordination::class)->run($request,
        function ($m, $a, $context) use ($epoch, $ministry, $member): int {
            $publisher = app(CoordinatedChangePublisher::class);
            $change = P::change($ministry, $member->id);
            $first = $publisher->append($context, $epoch, $change);
            expect(fn () => DB::transaction(function () use ($publisher, $context, $epoch, $change): void {
                $publisher->append($context, $epoch, $change);
                throw new RuntimeException('Deliberate savepoint failure');
            }))->toThrow(RuntimeException::class, 'Deliberate savepoint failure');
            $context->assertUsable();
            expect(DB::table('change_feed')->count())->toBe(1);
            expect((int) DB::table('sync_recovery_progress')->value('feed_head'))->toBe($first);

            return $publisher->append($context, $epoch, $change);
        }));
    $db = DB::connection('pgsql_migration');
    expect($db->table('change_feed')->count())->toBe(2);
    expect((int) $db->table('sync_recovery_progress')->value('feed_head'))->toBe($last);
    expect($db->table('sync_recovery_progress')->value('pruned_through'))->toBeNull();
});
