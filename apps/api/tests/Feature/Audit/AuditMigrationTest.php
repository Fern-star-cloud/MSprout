<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\ChurchScenario;
use Tests\Support\PostgresTestDatabase;

beforeEach(fn () => PostgresTestDatabase::refresh());

it('atomically upgrades populated Task 6 tables preserving identity provenance and timestamps exactly once', function () {
    [$owner, $church, $membership] = ChurchScenario::owner();
    $db = DB::connection('pgsql_migration');
    $db->beginTransaction();
    try {
        $db->statement('DROP TABLE security_events, audit_events');
        $db->table('migrations')->where('migration', 'like', '2026_09_22_%')->delete();
        $membershipId = (string) Str::uuid();
        $platformId = (string) Str::uuid();
        $correlation = (string) Str::uuid();
        $db->table('membership_audits')->insert(['id' => $membershipId, 'church_id' => $church->id, 'actor_id' => $owner->id, 'action' => 'ownership.transferred', 'target_id' => $membership->id, 'previous_owner_id' => $membership->id, 'risk' => 'high', 'result' => 'success', 'correlation_id' => $correlation, 'occurred_at' => '2026-09-21 00:00:00+00']);
        $db->table('platform_application_audits')->insert(['id' => $platformId, 'application_id' => (string) Str::uuid(), 'applicant_id' => $owner->id, 'actor_id' => (string) Str::uuid(), 'action' => 'application.rejected', 'category' => 'duplicate', 'correlation_id' => $correlation, 'occurred_at' => '2026-09-20 00:00:00+00']);
        foreach ([1, 2] as $run) {
            expect(Artisan::call('migrate', ['--database' => 'pgsql_migration', '--force' => true]))->toBe(0);
        }
        expect($db->table('audit_events')->count())->toBe(2);
        $row = $db->table('audit_events')->where('id', $membershipId)->first();
        expect($row->church_id)->toBe($church->id)->and($row->correlation_id)->toBe($correlation)
            ->and($row->occurred_at)->toBe('2026-09-21 00:00:00+00');
        expect(json_decode($row->metadata_json, true))->toBe(['risk' => 'high', 'previous_owner_id' => $membership->id]);
        expect($db->table('audit_events')->where('id', $platformId)->value('target_type'))->toBe('application');
        expect($db->table('membership_audits')->count())->toBe(1);
        expect($db->table('platform_application_audits')->count())->toBe(1);
        $migration = require database_path('migrations/2026_09_22_000001_create_audit_events_table.php');
        expect(fn () => $migration->down())->toThrow(LogicException::class);
        expect($db->table('audit_events')->count())->toBe(2);
    } finally {
        $db->rollBack();
    }
});

it('fails explicitly and atomically on conflicting legacy identities without losing either record', function () {
    [$owner, $church, $membership] = ChurchScenario::owner();
    $db = DB::connection('pgsql_migration');
    $db->beginTransaction();
    try {
        $db->statement('DROP TABLE security_events, audit_events');
        $id = (string) Str::uuid();
        $db->table('membership_audits')->insert(['id' => $id, 'church_id' => $church->id, 'actor_id' => $owner->id, 'action' => 'teacher.revoked', 'target_id' => $membership->id, 'correlation_id' => (string) Str::uuid(), 'occurred_at' => now()]);
        $db->table('platform_application_audits')->insert(['id' => $id, 'application_id' => (string) Str::uuid(), 'applicant_id' => $owner->id, 'actor_id' => (string) Str::uuid(), 'action' => 'application.approved', 'correlation_id' => (string) Str::uuid(), 'occurred_at' => now()]);
        $migration = require database_path('migrations/2026_09_22_000001_create_audit_events_table.php');
        DB::setDefaultConnection('pgsql_migration');
        try {
            expect(fn () => $db->transaction(fn () => $migration->up()))->toThrow(RuntimeException::class, 'Conflicting legacy audit identities');
        } finally {
            DB::setDefaultConnection('pgsql');
        }
        expect($db->table('membership_audits')->count())->toBe(1);
        expect($db->table('platform_application_audits')->count())->toBe(1);
        expect($db->getSchemaBuilder()->hasTable('audit_events'))->toBeFalse();
    } finally {
        $db->rollBack();
    }
});
