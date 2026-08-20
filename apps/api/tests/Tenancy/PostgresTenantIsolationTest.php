<?php

use App\Models\ChurchMembership;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Tests\Support\ChurchScenario;
use Tests\Support\PostgresTestDatabase;
use Tests\TestCase;

uses(TestCase::class);

beforeEach(function (): void {
    PostgresTestDatabase::refresh();

    Route::middleware(['auth', 'tenant.resolve', 'tenant.transaction'])
        ->prefix('api/_test/tenant-memberships')
        ->group(function (): void {
            Route::get('/{membership}', fn (string $membership) => response()->json(
                ChurchMembership::query()->findOrFail($membership)->only(['id', 'church_id']),
            ));
            Route::post('/', function (Request $request) {
                $membership = ChurchMembership::query()->create($request->only([
                    'id', 'church_id', 'user_id', 'role', 'status',
                ]));

                return response()->json($membership->only(['id', 'church_id']), 201);
            });
            Route::patch('/{membership}', function (Request $request, string $membership) {
                $record = ChurchMembership::query()->findOrFail($membership);
                $record->update($request->only(['church_id', 'status']));

                return response()->json($record->only(['id', 'church_id', 'status']));
            });
            Route::delete('/{membership}', function (string $membership) {
                ChurchMembership::query()->findOrFail($membership)->delete();

                return response()->noContent();
            });
        });
});

it('uses PostgreSQL 18 with restricted and separately owned runtime tables', function (): void {
    $role = DB::selectOne(<<<'SQL'
        SELECT current_user AS name,
               rolsuper::int AS superuser,
               rolbypassrls::int AS bypassrls
        FROM pg_roles WHERE rolname = current_user
        SQL);
    $migrationRole = DB::connection('pgsql_migration')->selectOne('SELECT current_user AS name');
    $tables = DB::select(<<<'SQL'
        SELECT c.relname AS name, pg_get_userbyid(c.relowner) AS owner
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = current_schema()
          AND c.relname IN ('churches', 'church_memberships')
        ORDER BY c.relname
        SQL);
    $version = (int) DB::selectOne(
        "SELECT current_setting('server_version_num')::int AS value",
    )->value;

    expect($version)->toBeGreaterThanOrEqual(180000)
        ->and($version)->toBeLessThan(190000)
        ->and($role->name)->toBe((string) env('DB_RUNTIME_USERNAME'))
        ->and($role->name)->not->toBe($migrationRole->name)
        ->and((int) $role->superuser)->toBe(0)
        ->and((int) $role->bypassrls)->toBe(0)
        ->and($tables)->toHaveCount(2);

    foreach ($tables as $table) {
        expect($table->owner)->not->toBe($role->name);
    }
});

it('blocks direct cross-church reads', function (): void {
    [$ownerA, $churchA] = ChurchScenario::owner();
    [, $churchB] = ChurchScenario::owner();
    [, $membershipB] = ChurchScenario::teacher($churchB);
    $this->actingAs($ownerA);

    $visible = app(TenantContext::class)->run(
        $churchA->id,
        fn (): bool => ChurchMembership::query()->whereKey($membershipB->id)->exists(),
    );

    expect($visible)->toBeFalse();
});

it('blocks direct cross-church inserts', function (): void {
    [$ownerA, $churchA] = ChurchScenario::owner();
    [, $churchB] = ChurchScenario::owner();
    $newUser = ChurchScenario::user();
    $this->actingAs($ownerA);

    expect(fn () => app(TenantContext::class)->run($churchA->id, fn () => ChurchMembership::query()->create([
        'id' => (string) Str::uuid(),
        'church_id' => $churchB->id,
        'user_id' => $newUser->id,
        'role' => 'teacher',
        'status' => 'active',
    ])))->toThrow(QueryException::class);
});

it('blocks direct cross-church updates and deletes', function (): void {
    [$ownerA, $churchA] = ChurchScenario::owner();
    [, $churchB] = ChurchScenario::owner();
    [, $membershipB] = ChurchScenario::teacher($churchB);
    $this->actingAs($ownerA);

    $results = app(TenantContext::class)->run($churchA->id, fn (): array => [
        ChurchMembership::query()->whereKey($membershipB->id)->update(['status' => 'inactive']),
        ChurchMembership::query()->whereKey($membershipB->id)->delete(),
    ]);

    expect($results)->toBe([0, 0]);
});

it('allows direct same-church inserts updates and deletes', function (): void {
    [$owner, $church] = ChurchScenario::owner();
    $newUser = ChurchScenario::user();
    $this->actingAs($owner);
    $membershipId = (string) Str::uuid();

    $results = app(TenantContext::class)->run($church->id, function () use ($church, $newUser, $membershipId): array {
        ChurchMembership::query()->create([
            'id' => $membershipId,
            'church_id' => $church->id,
            'user_id' => $newUser->id,
            'role' => 'teacher',
            'status' => 'active',
        ]);

        return [
            ChurchMembership::query()->whereKey($membershipId)->update(['status' => 'inactive']),
            ChurchMembership::query()->whereKey($membershipId)->delete(),
        ];
    });

    expect($results)->toBe([1, 1]);
});

it('fails closed for reads and writes without database tenant context', function (): void {
    [, $church] = ChurchScenario::owner();
    $newUser = ChurchScenario::user();

    expect(ChurchMembership::query()->count())->toBe(0)
        ->and(fn () => ChurchMembership::query()->create([
            'id' => (string) Str::uuid(),
            'church_id' => $church->id,
            'user_id' => $newUser->id,
            'role' => 'teacher',
            'status' => 'active',
        ]))->toThrow(QueryException::class);
});

it('enforces exactly one active owner at database commit', function (): void {
    [$owner, $church] = ChurchScenario::owner();
    $secondOwner = ChurchScenario::user();

    expect(fn () => DB::connection('pgsql_migration')->table('church_memberships')->insert([
        'id' => (string) Str::uuid(),
        'church_id' => $church->id,
        'user_id' => $secondOwner->id,
        'role' => 'owner',
        'status' => 'active',
        'created_at' => now(),
        'updated_at' => now(),
    ]))->toThrow(QueryException::class)
        ->and(fn () => DB::connection('pgsql_migration')->transaction(function () use ($owner, $church): void {
            DB::connection('pgsql_migration')->table('church_memberships')
                ->where('church_id', $church->id)
                ->where('user_id', $owner->id)
                ->update(['status' => 'inactive', 'updated_at' => now()]);
        }))->toThrow(PDOException::class)
        ->and(fn () => DB::connection('pgsql_migration')->transaction(function (): void {
            DB::connection('pgsql_migration')->table('churches')->insert([
                'id' => (string) Str::uuid(),
                'name' => 'Ownerless Church',
                'slug' => 'ownerless-'.Str::lower(Str::random(8)),
                'timezone' => 'Asia/Manila',
                'status' => 'active',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }))->toThrow(PDOException::class);
});

it('rejects missing invalid unauthorized and stale HTTP tenant context', function (): void {
    [$owner, $church] = ChurchScenario::owner();
    $outsider = ChurchScenario::user();
    [$teacher, $teacherMembership] = ChurchScenario::teacher($church);
    DB::connection('pgsql_migration')->table('church_memberships')
        ->where('id', $teacherMembership->id)
        ->update(['status' => 'inactive', 'updated_at' => now()]);
    $target = (string) Str::uuid();

    $this->actingAs($owner)->getJson("/api/_test/tenant-memberships/{$target}")->assertForbidden();
    $this->actingAs($owner)->withHeader('X-Church-Id', 'invalid')
        ->getJson("/api/_test/tenant-memberships/{$target}")->assertForbidden();
    $this->actingAs($outsider)->withHeader('X-Church-Id', $church->id)
        ->getJson("/api/_test/tenant-memberships/{$target}")->assertForbidden();
    $this->actingAs($teacher)->withHeader('X-Church-Id', $church->id)
        ->getJson("/api/_test/tenant-memberships/{$target}")->assertForbidden();
});

it('blocks HTTP cross-church reads inserts updates and deletes', function (): void {
    [$ownerA, $churchA] = ChurchScenario::owner();
    [, $churchB] = ChurchScenario::owner();
    [, $membershipB] = ChurchScenario::teacher($churchB);
    $newUser = ChurchScenario::user();
    $request = $this->actingAs($ownerA)->withHeader('X-Church-Id', $churchA->id);

    $request->getJson('/api/_test/tenant-memberships/'.$membershipB->id)->assertNotFound();
    $request->postJson('/api/_test/tenant-memberships', [
        'id' => (string) Str::uuid(),
        'church_id' => $churchB->id,
        'user_id' => $newUser->id,
        'role' => 'teacher',
        'status' => 'active',
    ])->assertForbidden();
    $request->patchJson('/api/_test/tenant-memberships/'.$membershipB->id, ['status' => 'inactive'])
        ->assertNotFound();
    $request->deleteJson('/api/_test/tenant-memberships/'.$membershipB->id)->assertNotFound();
});

it('allows authorized same-church HTTP access', function (): void {
    [$owner, $church, $membership] = ChurchScenario::owner();

    $this->actingAs($owner)
        ->withHeader('X-Church-Id', $church->id)
        ->getJson('/api/_test/tenant-memberships/'.$membership->id)
        ->assertOk()
        ->assertJsonPath('church_id', $church->id);
});
