<?php

use App\Jobs\PurgeRejectedApplications;
use App\Models\ChurchApplication;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\ChurchScenario;
use Tests\Support\PostgresTestDatabase;

beforeEach(fn () => PostgresTestDatabase::refresh());

function rejectedApplication(User $user, int $days = 31): ChurchApplication
{
    return ChurchApplication::create(['user_id' => $user->id, 'status' => 'rejected', 'church_name' => 'Example Church', 'city' => 'Example City', 'address' => 'Example address', 'timezone' => 'Asia/Manila', 'duplicate_key' => hash('sha256', 'example'), 'category' => 'incomplete', 'reason' => 'Example reason', 'decided_at' => now()->subDays($days), 'decided_by' => (string) Str::uuid(), 'correlation_id' => (string) Str::uuid()]);
}

it('purges rejected personal information at thirty days and deletes eligible identities and sessions', function () {
    $user = User::factory()->create();
    $old = rejectedApplication($user, 30);
    DB::table('sessions')->insert(['id' => 'expired-applicant', 'user_id' => $user->id, 'payload' => 'test', 'last_activity' => now()->timestamp]);
    DB::table('password_reset_tokens')->insert(['email' => $user->email, 'token' => 'test', 'created_at' => now()]);
    $recent = rejectedApplication(User::factory()->create(), 29);
    (new PurgeRejectedApplications)->handle();
    (new PurgeRejectedApplications)->handle();
    expect($old->fresh()->only(['church_name', 'city', 'address', 'timezone', 'duplicate_key', 'reason', 'user_id']))->toBe(array_fill_keys(['church_name', 'city', 'address', 'timezone', 'duplicate_key', 'reason', 'user_id'], null));
    expect($old->fresh()->category)->toBe('incomplete')->and($old->fresh()->purged_at)->not->toBeNull();
    expect(User::find($user->id))->toBeNull();
    expect(DB::table('sessions')->count())->toBe(0)->and(DB::table('password_reset_tokens')->count())->toBe(0);
    expect($recent->fresh()->reason)->toBe('Example reason');
});

it('preserves identities with active or recent applications and memberships hidden by RLS', function () {
    $user = User::factory()->create();
    rejectedApplication($user);
    ChurchApplication::create(['user_id' => $user->id, 'status' => 'pending']);
    [, $church] = ChurchScenario::owner();
    [$teacher] = ChurchScenario::teacher($church);
    $teacher = User::findOrFail($teacher->id);
    $old = rejectedApplication($teacher);
    expect($teacher->memberships()->count())->toBe(0); // Runtime cannot see the membership without a tenant scope.
    (new PurgeRejectedApplications)->handle();
    expect(User::find($user->id))->not->toBeNull()->and(User::find($teacher->id))->not->toBeNull();
    expect($old->fresh()->reason)->toBeNull();
    expect(DB::connection('pgsql_migration')->table('church_memberships')->where('user_id', $teacher->id)->count())->toBe(1);
});

it('denies direct runtime audit mutation', function () {
    foreach (['UPDATE platform_application_audits SET category = NULL', 'DELETE FROM platform_application_audits'] as $sql) {
        expect(fn () => DB::statement($sql))->toThrow(QueryException::class);
    }
});
