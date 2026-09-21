<?php

namespace App\Console\Commands;

use App\Mail\PlatformAdminSetupMail;
use App\Models\PlatformAdmin;
use Illuminate\Console\Command;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

final class BootstrapPlatformAdmin extends Command
{
    protected $signature = 'platform:bootstrap-admin {--handle=} {--email=}';

    protected $description = 'Invite the one-time MinistrySprout platform administrator';

    public function handle(): int
    {
        $handle = Str::lower(trim((string) $this->option('handle')));
        $email = Str::lower(trim((string) $this->option('email')));

        if ($handle !== 'sage.dev' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            $this->error('A valid sage.dev handle and recovery email are required.');

            return self::INVALID;
        }

        if (PlatformAdmin::query()->where('handle', $handle)->exists()) {
            $this->error('The platform administrator has already been bootstrapped.');

            return self::FAILURE;
        }

        try {
            $admin = PlatformAdmin::query()->create([
                'handle' => $handle,
                'recovery_email' => $email,
            ]);
            $admin->forceFill([
                'status' => 'pending',
                'password' => null,
                'setup_expires_at' => now()->addMinutes((int) config('auth.platform_setup_lifetime', 30)),
            ])->save();
        } catch (QueryException) {
            $this->error('The platform administrator has already been bootstrapped.');

            return self::FAILURE;
        }

        Mail::to($admin->recovery_email)->queue(new PlatformAdminSetupMail($admin));
        $this->info('The platform administrator setup invitation was queued.');

        return self::SUCCESS;
    }
}
