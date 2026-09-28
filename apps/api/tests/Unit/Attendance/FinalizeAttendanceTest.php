<?php

use App\Domain\Attendance\FinalizeAttendance;
use App\Domain\Audit\AuditWriter;
use App\Models\AttendanceRecord;
use App\Models\AttendanceSession;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\MembershipScenario;
use Tests\Support\PostgresTestDatabase;
use Tests\TestCase;

uses(TestCase::class);

beforeEach(function (): void {
    PostgresTestDatabase::refresh();
    [$this->owner, $this->church, $this->ownerMembership] = MembershipScenario::owner($this);
    $this->ministryId = MembershipScenario::ministry($this->church->id);
    $this->studentIds = collect(['Ana', 'Ben'])->map(function (string $name): string {
        $studentId = (string) Str::uuid();
        DB::connection('pgsql_migration')->table('students')->insert([
            'id' => $studentId,
            'church_id' => $this->church->id,
            'first_name' => $name,
            'last_name' => 'Sprout',
            'gender' => 'unspecified',
            'version' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::connection('pgsql_migration')->table('enrollments')->insert([
            'id' => (string) Str::uuid(),
            'church_id' => $this->church->id,
            'student_id' => $studentId,
            'ministry_id' => $this->ministryId,
            'version' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $studentId;
    })->all();
});

function attendanceDraftFor(object $test, array $states): AttendanceSession
{
    return app(TenantContext::class)->run($test->church->id, function () use ($test, $states): AttendanceSession {
        $session = AttendanceSession::create([
            'church_id' => $test->church->id,
            'ministry_id' => $test->ministryId,
            'attendance_date' => '2026-09-28',
            'status' => 'draft',
            'version' => 1,
        ]);
        foreach ($test->studentIds as $index => $studentId) {
            AttendanceRecord::create([
                'church_id' => $test->church->id,
                'attendance_session_id' => $session->id,
                'student_id' => $studentId,
                'state' => $states[$index],
                'version' => 1,
            ]);
        }

        return $session;
    });
}

it('rejects finalization while a regular roster entry is unmarked', function (): void {
    $session = attendanceDraftFor($this, ['present', 'unmarked']);

    expect(fn () => app(TenantContext::class)->run(
        $this->church->id,
        fn () => app(FinalizeAttendance::class)->handle($session->id, $this->owner),
    ))->toThrow(DomainException::class, 'unmarked');

    expect(DB::connection('pgsql_migration')->table('attendance_sessions')->where('id', $session->id)->value('status'))->toBe('draft')
        ->and(DB::connection('pgsql_migration')->table('audit_events')->where('action', 'attendance.finalized')->count())->toBe(0);
});

it('finalizes an all-marked draft atomically and preserves the actor in audit evidence', function (): void {
    $session = attendanceDraftFor($this, ['present', 'absent']);

    $finalized = app(TenantContext::class)->run(
        $this->church->id,
        fn () => app(FinalizeAttendance::class)->handle($session->id, $this->owner),
    );

    expect($finalized->status->value)->toBe('finalized')
        ->and($finalized->version)->toBe(2)
        ->and($finalized->finalized_by)->toBe($this->owner->id)
        ->and($finalized->finalized_at)->not->toBeNull();
    expect(DB::connection('pgsql_migration')->table('audit_events')
        ->where('church_id', $this->church->id)
        ->where('action', 'attendance.finalized')
        ->where('actor_id', (string) $this->owner->id)
        ->where('target_id', $session->id)
        ->count())->toBe(1);
});

it('rejects a draft whose records do not exactly match the active regular roster', function (): void {
    $session = attendanceDraftFor($this, ['present', 'absent']);
    DB::connection('pgsql_migration')->table('attendance_records')
        ->where('attendance_session_id', $session->id)
        ->where('student_id', $this->studentIds[1])
        ->update(['deleted_at' => now()]);

    expect(fn () => app(TenantContext::class)->run(
        $this->church->id,
        fn () => app(FinalizeAttendance::class)->handle($session->id, $this->owner),
    ))->toThrow(DomainException::class, 'roster');
});

it('rolls back finalization when required audit evidence cannot persist', function (): void {
    $session = attendanceDraftFor($this, ['present', 'absent']);
    $this->mock(AuditWriter::class)->shouldReceive('record')->once()->andThrow(new RuntimeException('private-marker'));

    expect(fn () => app(TenantContext::class)->run(
        $this->church->id,
        fn () => app(FinalizeAttendance::class)->handle($session->id, $this->owner),
    ))->toThrow(RuntimeException::class, 'private-marker');

    expect(DB::connection('pgsql_migration')->table('attendance_sessions')->where('id', $session->id)->value('status'))->toBe('draft');
});

it('enforces one session per church ministry date and one record per session student', function (): void {
    $session = attendanceDraftFor($this, ['present', 'absent']);

    expect(fn () => DB::connection('pgsql_migration')->table('attendance_sessions')->insert([
        'id' => (string) Str::uuid(),
        'church_id' => $this->church->id,
        'ministry_id' => $this->ministryId,
        'attendance_date' => '2026-09-28',
        'status' => 'draft',
        'version' => 1,
        'created_at' => now(),
        'updated_at' => now(),
    ]))->toThrow(QueryException::class);

    expect(fn () => DB::connection('pgsql_migration')->table('attendance_records')->insert([
        'id' => (string) Str::uuid(),
        'church_id' => $this->church->id,
        'attendance_session_id' => $session->id,
        'student_id' => $this->studentIds[0],
        'state' => 'present',
        'version' => 1,
        'created_at' => now(),
        'updated_at' => now(),
    ]))->toThrow(QueryException::class);
});
