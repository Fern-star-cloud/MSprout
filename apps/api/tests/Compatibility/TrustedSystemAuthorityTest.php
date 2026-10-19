<?php

use App\Domain\Audit\AuditEntry;
use App\Domain\Audit\AuditWriter;
use App\Domain\Sync\TrustedSystemCoordination;
use App\Domain\Sync\TrustedSystemPurpose;
use App\Support\Tenancy\TenantContext;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Tests\Support\AuthorityScenario;
use Tests\Support\ChurchScenario;
use Tests\Support\MaintenanceScenario;
use Tests\Support\PostgresTestDatabase;
use Tests\TestCase;

uses(TestCase::class);
beforeEach(function (): void {
    AuthorityScenario::guard();
    PostgresTestDatabase::refresh();
    [$this->systemActor, $this->systemChurch] = ChurchScenario::owner();
    [, $this->foreignChurch] = ChurchScenario::owner();
    Auth::forgetGuards();
});

it('keeps notification authority active-only while qualifying explicit inactive-church cleanup purpose', function (): void {
    $coordination = app(TrustedSystemCoordination::class);
    $id = $this->systemChurch->id;
    expect($coordination->run($id, TrustedSystemPurpose::BirthdayNotification, function ($context): int {
        $context->assertUsable();
        expect(DB::table('churches')->count())->toBe(1);

        return 1;
    }))->toBe(1);
    DB::connection('pgsql_migration')->table('churches')->where('id', $id)->update(['status' => 'suspended']);
    expect(fn () => $coordination->run($id, TrustedSystemPurpose::BirthdayNotification, fn () => true))->toThrow(AuthorizationException::class);
    expect(MaintenanceScenario::run(fn () => $coordination->run($id, TrustedSystemPurpose::RetentionCleanup, function ($context): bool {
        $context->assertUsable();
        expect(fn () => app(TenantContext::class)->role())->toThrow(LogicException::class);

        return DB::table('churches')->where('status', 'suspended')->count() === 1;
    })))->toBeTrue();
    expect(DB::transactionLevel())->toBe(0)
        ->and(DB::scalar("SELECT NULLIF(current_setting('app.current_church_id',true),'')"))->toBeNull();
});

it('rejects human impersonation and untyped requester-supplied purposes', function (): void {
    $coordination = app(TrustedSystemCoordination::class);
    Auth::guard('web')->setUser($this->systemActor);
    expect(fn () => $coordination->run($this->systemChurch->id, TrustedSystemPurpose::RetentionCleanup, fn () => true))->toThrow(AuthorizationException::class);
    Auth::forgetGuards();
    expect(fn () => $coordination->run($this->systemChurch->id, 'retention_cleanup', fn () => true))->toThrow(TypeError::class);
});

it('rolls back trusted callback work restores scope and expires its transaction capability without enabling publication', function (): void {
    $captured = null;
    expect(function () use (&$captured): void {
        MaintenanceScenario::run(function () use (&$captured): void {
            app(TrustedSystemCoordination::class)->run($this->systemChurch->id, TrustedSystemPurpose::RevokedDeviceCleanup, function ($context) use (&$captured): void {
                $captured = $context;
                app(AuditWriter::class)->record(new AuditEntry('church', 'operations.retention.pruned', 'system', null, 'system', null, 'success', $context->churchId, metadata: ['count' => 0]));
                throw new DomainException('Synthetic callback failure.');
            });
        });
    })->toThrow(DomainException::class);
    expect($captured !== null)->toBeTrue();
    expect(fn () => $captured->assertUsable())->toThrow(LogicException::class);
    expect(DB::transactionLevel())->toBe(0)
        ->and(DB::table('churches')->count())->toBe(0)
        ->and(DB::connection('pgsql_migration')->table('audit_events')->count())->toBe(0)
        ->and(DB::connection('pgsql_migration')->table('sync_recovery_progress')->count())->toBe(0)
        ->and(DB::scalar("SELECT has_function_privilege(current_user,'public.append_coordinated_change(uuid,uuid,text,uuid,uuid,character varying,uuid,integer,character varying,jsonb)','EXECUTE')"))->toBeFalse();
});
