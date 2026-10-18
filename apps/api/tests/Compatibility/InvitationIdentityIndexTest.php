<?php

use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Tests\Support\AuthorityScenario;
use Tests\Support\PostgresTestDatabase;
use Tests\TestCase;

uses(TestCase::class);
beforeEach(function (): void {
    AuthorityScenario::guard();
    PostgresTestDatabase::refresh();
});

it('rejects case and whitespace identity duplicates through the restricted runtime', function (): void {
    $first = User::factory()->create(['email' => 'CaseIdentity@example.test']);
    $refused = false;
    try {
        DB::transaction(fn () => User::factory()->create(['email' => ' caseidentity@example.test ']));
    } catch (UniqueConstraintViolationException) {
        $refused = true;
    }
    expect($refused)->toBeTrue()
        ->and(User::whereKey($first->id)->value('email') === 'CaseIdentity@example.test')->toBeTrue()
        ->and(User::count())->toBe(1);
});

it('blocks a collision-bearing migration without changing accounts and restores its isolated negative fixture by rollback', function (): void {
    $admin = DB::connection('pgsql_migration');
    $admin->beginTransaction();
    try {
        $admin->statement('DROP INDEX users_normalized_email_unique');
        $admin->table('users')->insert([
            ['name' => 'Synthetic collision', 'email' => 'Collision@example.test', 'password' => 'not-a-login-hash'],
            ['name' => 'Synthetic collision', 'email' => ' collision@example.test ', 'password' => 'not-a-login-hash'],
        ]);
        $before = hash('sha256', $admin->table('users')->orderBy('id')->get()->toJson());
        $migration = require database_path('migrations/2026_10_17_000002_add_normalized_user_email_uniqueness.php');
        $default = DB::getDefaultConnection();
        DB::setDefaultConnection('pgsql_migration');
        $blocked = false;
        try {
            $migration->up();
        } catch (RuntimeException) {
            $blocked = true;
        } finally {
            DB::setDefaultConnection($default);
        }
        expect($blocked)->toBeTrue()
            ->and(hash('sha256', $admin->table('users')->orderBy('id')->get()->toJson()) === $before)->toBeTrue();
    } finally {
        $admin->rollBack();
    }
    expect($admin->scalar("SELECT to_regclass('public.users_normalized_email_unique') IS NOT NULL"))->toBeTrue();
});
