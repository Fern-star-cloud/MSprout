<?php

namespace App\Console\Commands;

use App\Domain\Audit\AuditEntry;
use App\Domain\Audit\AuditWriter;
use App\Domain\Audit\CorrelationContext;
use App\Domain\Audit\SecurityEventWriter;
use App\Mail\PlatformAdminSetupMail;
use App\Models\PlatformAdmin;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

final class ReissuePlatformAdminSetup extends Command
{
    protected $signature = 'platform:reissue-admin-setup {--handle=}';

    protected $description = 'Reissue setup only for the existing unactivated sage.dev administrator';

    public function handle(): int
    {
        if ($this->option('handle') !== 'sage.dev') {
            $this->error('The sage.dev handle is required.');

            return self::INVALID;
        }

        $context = app(CorrelationContext::class);
        $correlationId = $context->start();
        try {
            $this->requirePrivateTransport((string) config('mail.default'));
            // Persist the job, generation and required evidence in the same PostgreSQL transaction.
            abort_unless(DB::connection()->getDriverName() === 'pgsql'
                && config('queue.connections.database.driver') === 'database'
                && in_array(config('queue.connections.database.connection'), [null, DB::getDefaultConnection()], true), 503);
            DB::transaction(function (): void {
                $admin = PlatformAdmin::query()->where('handle', 'sage.dev')->lockForUpdate()->first();
                abort_unless($admin && $admin->eligibleForSetup()
                    && filter_var($admin->recovery_email, FILTER_VALIDATE_EMAIL) !== false, 403);
                abort_if($admin->setup_issued_at && $admin->setup_issued_at->addMinutes(5)->isFuture(), 429);
                $admin->forceFill([
                    'setup_generation' => $admin->setup_generation + 1,
                    'setup_redeemed_at' => null,
                    'setup_issued_at' => now(),
                    'setup_expires_at' => now()->addMinutes(max(1, min(30, (int) config('auth.platform_setup_lifetime', 30)))),
                ])->save();
                app(SecurityEventWriter::class)->record('platform.setup_reissued', 'success', 'system');
                app(AuditWriter::class)->record(new AuditEntry('platform', 'platform.setup_reissued', 'system', null, 'platform_admin', $admin->id));
                Mail::to($admin->recovery_email)->queue((new PlatformAdminSetupMail($admin))->onConnection('database')->beforeCommit());
            });
            $this->info('The platform setup invitation was queued. Correlation ID: '.$correlationId);

            return self::SUCCESS;
        } catch (Throwable $exception) {
            $message = $exception instanceof HttpExceptionInterface && $exception->getStatusCode() === 429
                ? 'Wait five minutes after the last invitation before reissuing.'
                : 'Setup could not be reissued. Verify eligibility and private mail/database queue configuration.';
            $this->error($message.' Correlation ID: '.$correlationId);

            return self::FAILURE;
        } finally {
            $context->clear();
        }
    }

    private function requirePrivateTransport(string $mailer, array $visited = []): void
    {
        abort_if(in_array($mailer, $visited, true), 503);
        $settings = config('mail.mailers.'.$mailer, []);
        $transport = $settings['transport'] ?? null;
        if (in_array($transport, ['failover', 'roundrobin'], true)) {
            abort_if(empty($settings['mailers']), 503);
            foreach ($settings['mailers'] as $child) {
                $this->requirePrivateTransport($child, [...$visited, $mailer]);
            }

            return;
        }
        abort_unless(in_array($transport, ['smtp', 'sendmail', 'ses', 'ses-v2', 'postmark', 'resend', 'mailgun'], true)
            || ($transport === 'array' && app()->environment('testing')), 503);
    }
}
