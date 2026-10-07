<?php

use App\Domain\Audit\AuditWriter;
use App\Domain\Audit\SecurityEventWriter;
use App\Mail\PlatformAdminSetupMail;
use App\Models\PlatformAdmin;
use Illuminate\Mail\MailManager;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use PragmaRX\Google2FA\Google2FA;
use Symfony\Component\Console\Exception\InvalidOptionException;
use Symfony\Component\Process\Process;
use Tests\Support\PostgresTestDatabase;

beforeEach(function () {
    PostgresTestDatabase::refresh();
    Mail::fake();
    $this->admin = PlatformAdmin::factory()->create(['handle' => 'sage.dev']);
    $this->password = Str::password(32);
});

function reissueSetup(): int
{
    return Artisan::call('platform:reissue-admin-setup', ['--handle' => 'sage.dev']);
}

it('reissues only to the stored email without altering unfinished credentials or identity', function () {
    $this->admin->forceFill(['password' => $this->password, 'two_factor_secret' => encrypt('unfinished'), 'two_factor_recovery_codes' => encrypt('[]'), 'email_verified_at' => now()])->save();
    $before = $this->admin->fresh()->getAttributes();
    expect(reissueSetup())->toBe(0);
    $admin = $this->admin->fresh();
    expect($admin->setup_generation)->toBe(2)->and($admin->setup_expires_at->isFuture())->toBeTrue();
    foreach (['id', 'handle', 'recovery_email', 'password', 'two_factor_secret', 'two_factor_recovery_codes', 'email_verified_at', 'status'] as $field) {
        expect($admin->getRawOriginal($field))->toBe($before[$field]);
    }
    Mail::assertQueued(PlatformAdminSetupMail::class, fn ($mail) => $mail->hasTo($admin->recovery_email));
    expect(Artisan::output())->not->toContain($admin->recovery_email)->not->toContain('signature=');
});

it('rejects active disabled or previously activated records', function (array $state) {
    $this->admin->forceFill($state)->save();
    $before = $this->admin->fresh()->getAttributes();
    expect(reissueSetup())->toBe(1)->and($this->admin->fresh()->getAttributes())->toBe($before);
    Mail::assertNothingQueued();
})->with([
    'active' => [['status' => 'active']],
    'disabled' => [['status' => 'disabled']],
    'MFA confirmed' => [['two_factor_confirmed_at' => now()]],
    'recovery acknowledged' => [['recovery_codes_acknowledged_at' => now()]],
    'previously authenticated' => [['last_authenticated_at' => now()]],
]);

it('accepts no identity or credential override and rejects missing or other handles', function () {
    $definition = Artisan::all()['platform:reissue-admin-setup']->getDefinition();
    foreach (['email', 'password', 'recovery-email', 'status'] as $option) {
        expect($definition->hasOption($option))->toBeFalse();
    }
    expect(fn () => Artisan::call('platform:reissue-admin-setup', ['--handle' => 'sage.dev', '--email' => 'replacement@example.test']))->toThrow(InvalidOptionException::class);
    expect(Artisan::call('platform:reissue-admin-setup'))->toBe(2);
    expect(Artisan::call('platform:reissue-admin-setup', ['--handle' => 'other']))->toBe(2);
    $this->admin->delete(); // Isolated test fixture only.
    expect(reissueSetup())->toBe(1);
    Mail::assertNothingQueued();
});

it('invalidates old links and unfinished sessions and activates only the newest redemption', function () {
    $oldMail = new PlatformAdminSetupMail($this->admin);
    $oldUrl = $oldMail->setupUrl();
    $oldEnrollment = $this->postJson($oldUrl, ['password' => $this->password, 'password_confirmation' => $this->password])->assertOk()->json();
    $this->postJson($oldUrl, ['password' => $this->password, 'password_confirmation' => $this->password])->assertGone();
    expect(reissueSetup())->toBe(0);
    $this->getJson($oldUrl)->assertGone();
    $this->postJson($oldUrl, ['password' => $this->password, 'password_confirmation' => $this->password])->assertGone();
    $confirm = '/platform/setup/'.$this->admin->id.'/confirm';
    $this->postJson($confirm, ['code' => (new Google2FA)->getCurrentOtp($oldEnrollment['secret']), 'recovery_codes_acknowledged' => true])->assertForbidden();
    $mail = unserialize(serialize(new PlatformAdminSetupMail($this->admin->fresh())));
    $url = $mail->setupUrl();
    $this->getJson($url)->assertOk();
    $enrollment = $this->postJson($url, ['password' => $this->password, 'password_confirmation' => $this->password])->assertOk()->json();
    expect($enrollment['secret'])->not->toBe($oldEnrollment['secret']);
    $this->getJson($url)->assertGone();
    $this->postJson($url, ['password' => $this->password, 'password_confirmation' => $this->password])->assertGone();
    // Let the existing per-IP setup/confirmation throttle window expire.
    $this->travel(61)->seconds();
    $this->withSession(['platform.setup_generation' => 1]);
    $this->postJson($confirm, ['code' => (new Google2FA)->getCurrentOtp($enrollment['secret']), 'recovery_codes_acknowledged' => true])->assertForbidden();
    $this->withSession(['platform.setup_generation' => 2]);
    $this->postJson($confirm, ['code' => 'invalid', 'recovery_codes_acknowledged' => true])->assertUnprocessable();
    $this->postJson($confirm, ['code' => (new Google2FA)->getCurrentOtp($enrollment['secret']), 'recovery_codes_acknowledged' => false])->assertUnprocessable();
    $this->postJson($confirm, ['code' => (new Google2FA)->getCurrentOtp($enrollment['secret']), 'recovery_codes_acknowledged' => true])->assertNoContent();
    expect($this->admin->fresh()->status)->toBe('active');
    $this->getJson('/platform/me')->assertOk();
    expect(reissueSetup())->toBe(1);
});

it('rejects generationless legacy links and expired or tampered current links', function () {
    $url = URL::temporarySignedRoute('platform.setup.show', now()->addMinutes(20), ['platformAdmin' => $this->admin->id]);
    $this->getJson($url)->assertGone();
    $url = (new PlatformAdminSetupMail($this->admin))->setupUrl();
    $this->getJson($url.'&extra=1')->assertForbidden();
    $this->travel(31)->minutes();
    $this->getJson($url)->assertForbidden();
});

it('keeps the initial password gate for pre-migration unfinished enrollment', function () {
    $this->admin->forceFill(['password' => $this->password])->save();
    $url = (new PlatformAdminSetupMail($this->admin))->setupUrl();
    $this->getJson($url)->assertGone();
    $this->postJson($url, ['password' => $this->password, 'password_confirmation' => $this->password])->assertGone();
});

it('binds queued mail to its original generation and expiry despite model rehydration', function () {
    $mail = new PlatformAdminSetupMail($this->admin);
    $url = $mail->setupUrl();
    $queued = serialize($mail);
    expect(reissueSetup())->toBe(0);
    $stale = unserialize($queued);
    expect($stale->setupUrl())->toBe($url);
    $this->getJson($stale->setupUrl())->assertGone();
    $this->travel(6)->minutes();
    expect(reissueSetup())->toBe(0);
    $this->getJson(unserialize($queued)->setupUrl())->assertGone();
});

it('enforces a five minute cooldown without changing a valid generation', function () {
    expect(reissueSetup())->toBe(0);
    $before = $this->admin->fresh()->getAttributes();
    expect(reissueSetup())->toBe(1)->and($this->admin->fresh()->getAttributes())->toBe($before);
    Mail::assertQueued(PlatformAdminSetupMail::class, 1);
    $this->travel(5)->minutes();
    expect(reissueSetup())->toBe(0)->and($this->admin->fresh()->setup_generation)->toBe(3);
});

it('records correlated system audit evidence without secrets or PII', function () {
    expect(reissueSetup())->toBe(0);
    $audit = DB::table('audit_events')->where('action', 'platform.setup_reissued')->first();
    $security = DB::table('security_events')->where('action', 'platform.setup_reissued')->first();
    expect($audit->actor_type)->toBe('system')->and($audit->target_id)->toBe($this->admin->id)
        ->and($audit->church_id)->toBeNull()->and($audit->result)->toBe('success')
        ->and(Str::isUuid($audit->correlation_id))->toBeTrue()
        ->and($security->correlation_id)->toBe($audit->correlation_id);
    expect(json_encode([$audit, $security]))->not->toContain($this->admin->recovery_email)->not->toContain('signature=');
    expect(Artisan::output())->toContain($audit->correlation_id);
});

it('rolls back generation and both evidence stores and queues nothing when audit fails', function () {
    $before = $this->admin->fresh()->getAttributes();
    $this->mock(AuditWriter::class)->makePartial()->shouldReceive('record')->once()->andThrow(new RuntimeException('private-marker'));
    expect(reissueSetup())->toBe(1)->and($this->admin->fresh()->getAttributes())->toBe($before);
    expect(DB::table('audit_events')->count())->toBe(0)->and(DB::table('security_events')->count())->toBe(0);
    Mail::assertNothingQueued();
    expect(Artisan::output())->not->toContain('private-marker');
});

it('refuses nonprivate transport before mutation', function () {
    config(['mail.default' => 'log']);
    expect(reissueSetup())->toBe(1)->and($this->admin->fresh()->setup_generation)->toBe(1);
    Mail::assertNothingQueued();
});

it('rolls back issuance and evidence when the transactional queue insert fails', function () {
    $before = $this->admin->fresh()->getAttributes();
    Mail::swap(new MailManager($this->app));
    // Force a real insert failure only in the isolated test database.
    $migration = DB::connection('pgsql_migration');
    $migration->statement('ALTER TABLE jobs ADD CONSTRAINT reissue_test_queue_failure CHECK (false) NOT VALID');
    try {
        expect(reissueSetup())->toBe(1)->and($this->admin->fresh()->getAttributes())->toBe($before);
        expect(DB::table('audit_events')->count())->toBe(0)->and(DB::table('security_events')->count())->toBe(0)
            ->and(DB::table('jobs')->count())->toBe(0);
        expect(Artisan::output())->not->toContain('reissue_test_queue_failure');
    } finally {
        $migration->statement('ALTER TABLE jobs DROP CONSTRAINT reissue_test_queue_failure');
    }
});

it('rolls back when required security evidence fails', function () {
    $before = $this->admin->fresh()->getAttributes();
    $this->mock(SecurityEventWriter::class)->shouldReceive('record')->once()->andThrow(new RuntimeException('private-security-error'));
    expect(reissueSetup())->toBe(1)->and($this->admin->fresh()->getAttributes())->toBe($before);
    expect(DB::table('audit_events')->count())->toBe(0)->and(DB::table('security_events')->count())->toBe(0);
    Mail::assertNothingQueued();
});

it('cannot upgrade a pre-generation queued message into a current invitation', function () {
    $mail = new PlatformAdminSetupMail($this->admin);
    unset($mail->generation, $mail->expires);
    $queued = serialize($mail);
    expect(reissueSetup())->toBe(0);
    $legacy = unserialize($queued);
    expect($legacy->generation)->toBe(0)->and($legacy->expires)->toBe(0);
    $this->getJson($legacy->setupUrl())->assertGone();
});

it('requires real platform CSRF for redemption and activation', function () {
    $this->app->instance('env', 'local');
    $url = (new PlatformAdminSetupMail($this->admin))->setupUrl();
    $this->postJson($url, ['password' => $this->password, 'password_confirmation' => $this->password])->assertStatus(419);
    $this->postJson('/platform/setup/'.$this->admin->id.'/confirm', ['code' => '123456', 'recovery_codes_acknowledged' => true])->assertStatus(419);
    expect($this->admin->fresh()->password)->toBeNull()->and($this->admin->fresh()->status)->toBe('pending');
});

it('refuses a queue connection outside the domain transaction', function () {
    config(['queue.connections.database.connection' => 'pgsql_migration']);
    expect(reissueSetup())->toBe(1)->and($this->admin->fresh()->setup_generation)->toBe(1);
    Mail::assertNothingQueued();
});

it('serializes simultaneous reissues to one generation one queue job and one audit', function () {
    $connection = DB::connection('pgsql_migration');
    $workers = [];
    $labels = [];
    $connection->beginTransaction();
    $connection->table('platform_admins')->where('id', $this->admin->id)->lockForUpdate()->first();
    try {
        for ($i = 0; $i < 2; $i++) {
            $label = 'reissue-test-'.Str::uuid();
            $labels[] = $label;
            $process = new Process([PHP_BINARY, base_path('tests/Support/reissue-worker.php')], base_path(), ['APP_ENV' => 'testing']);
            $process->setInput(json_encode(['connection' => config('database.connections.pgsql'), 'key' => config('app.key'), 'label' => $label], JSON_THROW_ON_ERROR));
            $process->setTimeout(30)->start();
            $workers[] = $process;
        }
        $deadline = microtime(true) + 15;
        do {
            $connection->select('SELECT pg_stat_clear_snapshot()');
            $waiting = $connection->table('pg_stat_activity')->whereIn('application_name', $labels)->where('wait_event_type', 'Lock')->count();
            if ($waiting === 2) {
                break;
            }
            usleep(50000);
        } while (microtime(true) < $deadline);
        expect($waiting)->toBe(2);
        $connection->commit();
        $results = [];
        foreach ($workers as $worker) {
            $worker->wait();
            $results[] = $worker->getOutput();
        }
        sort($results);
        expect($results)->toBe(['denied', 'reissued']);
        expect($this->admin->fresh()->setup_generation)->toBe(2);
        expect(DB::table('jobs')->count())->toBe(1);
        expect(DB::table('audit_events')->where('action', 'platform.setup_reissued')->count())->toBe(1);
        $payload = json_decode(DB::table('jobs')->first()->payload, true, 512, JSON_THROW_ON_ERROR);
        $audit = DB::table('audit_events')->where('action', 'platform.setup_reissued')->first();
        expect($payload['correlation_id'])->toBe($audit->correlation_id);
    } finally {
        if ($connection->transactionLevel() > 0) {
            $connection->rollBack();
        }
        foreach ($workers as $worker) {
            if ($worker->isRunning()) {
                $worker->stop();
            }
        }
    }
});
