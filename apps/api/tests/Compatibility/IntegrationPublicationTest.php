<?php

use App\Actions\Attendance\CorrectAttendance;
use App\Actions\Memberships\ManageTeachers;
use App\Domain\Attendance\PublishAttendanceChange;
use App\Domain\Audit\AuditEntry;
use App\Domain\Audit\AuditWriter;
use App\Domain\Sync\ApplySyncBatch;
use App\Domain\Sync\ChurchCoordination;
use App\Models\AttendanceSession;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\AuthorityScenario as A;
use Tests\Support\ChurchScenario;
use Tests\Support\IntegrationScenario as I;
use Tests\Support\MembershipScenario;
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

it('leaves coordinated publication explicitly disabled by default', function (): void {
    expect(config('synchronization.coordinated_publication'))->toBeFalse();
});

it('refuses configured coordinated publication without qualified activation instead of falling back', function (): void {
    [$church, $actor, , $request] = A::fixture($this);
    $ministry = MembershipScenario::ministry($church->id);
    config(['synchronization.coordinated_publication' => true]);
    expect(fn () => app(TenantContext::class)->run($church->id, fn () => app(ChurchCoordination::class)->run($request, function () use ($church, $ministry): void {
        $session = AttendanceSession::create(['church_id' => $church->id, 'ministry_id' => $ministry, 'attendance_date' => now()->toDateString(), 'status' => 'draft', 'version' => 1]);
        app(PublishAttendanceChange::class)->handle($session);
    })))->toThrow(LogicException::class);
    expect(DB::connection('pgsql_migration')->table('attendance_sessions')->count())->toBe(0)
        ->and(DB::connection('pgsql_migration')->table('change_feed')->count())->toBe(0);
});

it('publishes the unchanged legacy attendance representation and a committed head after real cutover', function (): void {
    [$church, , , $request, $ministry] = I::ownerFixture($this);
    $session = app(TenantContext::class)->run($church->id, fn () => app(ChurchCoordination::class)->run($request, function () use ($church, $ministry): AttendanceSession {
        $session = AttendanceSession::create(['church_id' => $church->id, 'ministry_id' => $ministry, 'attendance_date' => now()->toDateString(), 'status' => 'draft', 'version' => 1]);
        app(PublishAttendanceChange::class)->handle($session);

        return $session;
    }));
    $db = DB::connection('pgsql_migration');
    $before = $db->table('change_feed')->first();
    $activation = I::activate();
    app(TenantContext::class)->run($church->id, fn () => app(ChurchCoordination::class)->run($request, fn () => app(PublishAttendanceChange::class)->handle($session)));
    $after = $db->table('change_feed')->orderByDesc('sequence')->first();
    expect(json_decode($after->payload_json, true))->toEqual(json_decode($before->payload_json, true))
        ->and((int) $after->sequence)->toBeGreaterThan((int) $activation['allocation_floor'])
        ->and((int) $db->table('sync_recovery_progress')->where('church_id', $church->id)->value('feed_head'))->toBe((int) $after->sequence)
        ->and($db->table('change_feed')->count())->toBe(2);
});

it('keeps only committed publication after a nested savepoint rollback and preserves harmless sequence gaps', function (): void {
    [$church, , , $request, $ministry] = I::ownerFixture($this);
    I::activate();
    app(TenantContext::class)->run($church->id, fn () => app(ChurchCoordination::class)->run($request, function () use ($church, $ministry): void {
        $session = AttendanceSession::create(['church_id' => $church->id, 'ministry_id' => $ministry, 'attendance_date' => now()->toDateString(), 'status' => 'draft', 'version' => 1]);
        try {
            DB::transaction(function () use ($session): void {
                app(PublishAttendanceChange::class)->handle($session);
                throw new RuntimeException('isolated savepoint');
            });
        } catch (RuntimeException $error) {
            expect($error->getMessage())->toBe('isolated savepoint');
        }
        expect(DB::table('change_feed')->count())->toBe(0);
        app(PublishAttendanceChange::class)->handle($session);
    }));
    $db = DB::connection('pgsql_migration');
    expect($db->table('change_feed')->count())->toBe(1)
        ->and((int) $db->table('sync_recovery_progress')->where('church_id', $church->id)->value('feed_head'))->toBe((int) $db->table('change_feed')->value('sequence'))
        ->and($db->table('sync_recovery_progress')->where('church_id', $church->id)->value('pruned_through'))->toBeNull();
});

it('refuses legacy direct feed sequence and head bypass rights after activation', function (): void {
    [$church, , , $request, $ministry] = I::ownerFixture($this);
    I::activate();
    foreach (["SELECT nextval('public.change_feed_sequence_seq')", 'UPDATE public.sync_recovery_progress SET feed_head=feed_head+1'] as $sql) {
        try {
            DB::statement($sql);
            throw new RuntimeException('Runtime bypass allowed');
        } catch (QueryException $error) {
            expect($error->errorInfo[0])->toBe('42501');
        }
    }
    config(['synchronization.coordinated_publication' => false]);
    expect(fn () => app(TenantContext::class)->run($church->id, fn () => app(ChurchCoordination::class)->run($request, function () use ($church, $ministry): void {
        $session = AttendanceSession::create(['church_id' => $church->id, 'ministry_id' => $ministry, 'attendance_date' => now()->toDateString(), 'status' => 'draft', 'version' => 1]);
        app(PublishAttendanceChange::class)->handle($session);
    })))->toThrow(QueryException::class);
    expect(DB::connection('pgsql_migration')->table('attendance_sessions')->count())->toBe(0)
        ->and(DB::connection('pgsql_migration')->table('change_feed')->count())->toBe(0);
});

it('keeps sync domain events receipts finalization and corrections atomic on the coordinated publisher', function (): void {
    [$church,$actor,$member,$request,$ministry] = I::ownerFixture($this);
    $db = DB::connection('pgsql_migration');
    $students = [];
    foreach (range(1, 2) as $i) {
        $id = Str::uuid()->toString();
        $students[] = $id;
        $db->table('students')->insert(['id' => $id, 'church_id' => $church->id, 'first_name' => 'Synthetic', 'last_name' => 'Qualification', 'gender' => 'unspecified', 'version' => 1]);
        $db->table('enrollments')->insert(['id' => Str::uuid()->toString(), 'church_id' => $church->id, 'student_id' => $id, 'ministry_id' => $ministry, 'version' => 1]);
    }
    $session = Str::uuid()->toString();
    $device = Str::uuid()->toString();
    $event = fn ($action, $version, $payload) => ['client_event_id' => Str::uuid()->toString(), 'entity_id' => $session, 'action' => $action, 'base_version' => $version, 'occurred_at' => now()->toISOString(), 'payload' => $payload];
    $events = [
        $event('attendance.draft_created', 0, ['ministry_id' => $ministry, 'attendance_date' => now()->toDateString(), 'student_ids' => $students]),
        $event('attendance.student_marked', 1, ['student_id' => $students[0], 'state' => 'present']),
        $event('attendance.bulk_marked', 2, ['student_ids' => [$students[1]], 'state' => 'present']),
        $event('attendance.guest_added', 3, ['display_name' => 'Synthetic Guest']),
        $event('attendance.finalized', 4, []),
    ];
    I::activate();
    $apply = fn () => app(TenantContext::class)->run($church->id, fn () => app(ChurchCoordination::class)->run($request, fn () => app(ApplySyncBatch::class)->handle($member, $device, Str::uuid()->toString(), $events, $actor)));
    $first = $apply();
    expect(array_column($first, 'status'))->toBe(array_fill(0, 5, 'accepted'));
    $retry = $apply();
    expect(array_column($retry, 'status'))->toBe(array_fill(0, 5, 'duplicate'));
    expect($db->table('sync_events')->count())->toBe(5)->and($db->table('change_feed')->count())->toBe(5)
        ->and($db->table('attendance_sessions')->where('id', $session)->value('status'))->toBe('finalized');
    $record = $db->table('attendance_records')->where('student_id', $students[0])->first();
    app(TenantContext::class)->run($church->id, fn () => app(ChurchCoordination::class)->run($request, fn () => app(CorrectAttendance::class)->handle($session, $record->id, 'absent', 'Synthetic qualification correction.', $actor)));
    expect($db->table('attendance_records')->where('id', $record->id)->value('state'))->toBe('present')
        ->and($db->table('attendance_revisions')->where('attendance_record_id', $record->id)->value('after_state'))->toBe('absent')
        ->and($db->table('change_feed')->count())->toBe(6)
        ->and((int) $db->table('sync_recovery_progress')->where('church_id', $church->id)->value('feed_head'))->toBe((int) $db->table('change_feed')->max('sequence'));
});

it('keeps the targeted assignment tombstone representation and audit failure rollback', function (): void {
    [$church,$actor,$ownerMember,$request,$ministry] = I::ownerFixture($this);
    [,$member] = ChurchScenario::teacher($church);
    $db = DB::connection('pgsql_migration');
    $assignment = Str::uuid()->toString();
    $db->table('teacher_ministry_assignments')->insert(['id' => $assignment, 'church_id' => $church->id, 'membership_id' => $member->id, 'ministry_id' => $ministry, 'assigned_by' => $actor->id]);
    I::activate();
    app(TenantContext::class)->run($church->id, fn () => app(ChurchCoordination::class)->run($request, fn () => app(ManageTeachers::class)->assign($member, [], $actor->id)));
    $row = $db->table('change_feed')->first();
    expect($row->entity_type)->toBe('ministry_assignment')->and($row->target_membership_id)->toBe($member->id)
        ->and(json_decode($row->payload_json, true))->toBe(['ministry_id' => $ministry]);
    $beforeHead = $db->table('sync_recovery_progress')->where('church_id', $church->id)->value('feed_head');
    $this->instance(AuditWriter::class, new class extends AuditWriter
    {
        public function record(AuditEntry $event): void
        {
            throw new RuntimeException('isolated required audit failure');
        }
    });
    $event = ['client_event_id' => Str::uuid()->toString(), 'entity_id' => Str::uuid()->toString(), 'action' => 'attendance.draft_created', 'base_version' => 0, 'occurred_at' => now()->toISOString(), 'payload' => ['ministry_id' => $ministry, 'attendance_date' => now()->toDateString(), 'student_ids' => []]];
    expect(fn () => app(TenantContext::class)->run($church->id, fn () => app(ChurchCoordination::class)->run($request, fn () => app(ApplySyncBatch::class)->handle($ownerMember, Str::uuid()->toString(), Str::uuid()->toString(), [$event], $actor))))->toThrow(RuntimeException::class);
    expect($db->table('attendance_sessions')->count())->toBe(0)->and($db->table('change_feed')->count())->toBe(1)
        ->and($db->table('sync_recovery_progress')->where('church_id', $church->id)->value('feed_head'))->toBe($beforeHead);
});
