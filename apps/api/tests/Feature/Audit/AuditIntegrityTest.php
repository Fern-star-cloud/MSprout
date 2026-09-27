<?php

use App\Domain\Audit\AuditEntry;
use App\Domain\Audit\AuditWriter;
use App\Domain\Audit\SecurityEventWriter;
use App\Models\AuditEvent;
use App\Models\SecurityEvent;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\ChurchScenario;
use Tests\Support\MembershipScenario;
use Tests\Support\PostgresTestDatabase;

beforeEach(fn () => PostgresTestDatabase::refresh());

it('rejects normal and quiet model mutations and direct runtime mutations', function () {
    $event = AuditEvent::factory()->create();
    app(SecurityEventWriter::class)->record('auth.login', 'success');
    foreach ([$event, SecurityEvent::firstOrFail()] as $row) {
        expect(fn () => $row->update(['result' => 'failure']))->toThrow(LogicException::class);
        expect(fn () => $row->delete())->toThrow(LogicException::class);
        expect(fn () => $row->forceFill(['result' => 'failure'])->saveQuietly())->toThrow(LogicException::class);
        expect(fn () => $row->deleteQuietly())->toThrow(LogicException::class);
        foreach (['UPDATE '.$row->getTable()." SET result = 'failure'", 'DELETE FROM '.$row->getTable(), 'TRUNCATE '.$row->getTable()] as $sql) {
            expect(fn () => DB::statement($sql))->toThrow(QueryException::class);
        }
    }
});

it('forces RLS for tenant reads writes and absent context', function () {
    [$owner, $church] = MembershipScenario::owner($this);
    [, $other] = ChurchScenario::owner();
    app(TenantContext::class)->run($church->id, function () use ($owner, $church, $other) {
        app(AuditWriter::class)->record(new AuditEntry('church', 'teacher.revoked', 'user', (string) $owner->id, 'membership', (string) Str::uuid(), churchId: $church->id));
        expect(AuditEvent::count())->toBe(1);
        $row = AuditEvent::firstOrFail()->getAttributes();
        $row['id'] = (string) Str::uuid();
        $row['church_id'] = $other->id;
        expect(fn () => DB::transaction(fn () => DB::table('audit_events')->insert($row)))->toThrow(QueryException::class);
        expect(fn () => app(AuditWriter::class)->record(new AuditEntry('church', 'teacher.revoked', 'user', (string) $owner->id, 'membership', (string) Str::uuid(), churchId: $other->id)))->toThrow(LogicException::class);
    });
    expect(AuditEvent::count())->toBe(0);
    expect(fn () => app(AuditWriter::class)->record(new AuditEntry('church', 'teacher.revoked', 'user', (string) $owner->id, 'membership', (string) Str::uuid(), churchId: $church->id)))->toThrow(LogicException::class);
});

it('rejects metadata outside the explicit non PII allowlist', function () {
    expect(fn () => app(AuditWriter::class)->record(new AuditEntry('platform', 'application.approved', 'system', null, 'application', (string) Str::uuid(), metadata: ['password' => 'private-marker'])))->toThrow(InvalidArgumentException::class);
});

it('uses one UUID in successful and error responses', function () {
    foreach (['/api/health', '/api/me', '/unknown-route', '/'] as $path) {
        foreach ([null, 'invalid', (string) Str::uuid()] as $supplied) {
            $response = $this->withHeader('X-Correlation-Id', $supplied ?? '')->getJson($path);
            $id = $response->headers->get('X-Correlation-Id');
            expect(Str::isUuid($id))->toBeTrue();
            if (Str::isUuid($supplied)) {
                expect($id)->toBe($supplied);
            }
            if ($response->status() >= 400) {
                expect($response->json('correlation_id'))->toBe($id);
            }
        }
    }
});
