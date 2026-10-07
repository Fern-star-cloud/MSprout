<?php

namespace App\Mail;

use App\Models\PlatformAdmin;
use Carbon\CarbonImmutable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\URL;

final class PlatformAdminSetupMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    // Scalars survive SerializesModels rehydration; old jobs keep generation zero.
    public int $generation = 0;

    public int $expires = 0;

    public function __construct(public readonly PlatformAdmin $admin)
    {
        $this->generation = $admin->setup_generation;
        $this->expires = $admin->setup_expires_at->timestamp;
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Complete your MinistrySprout platform setup');
    }

    public function content(): Content
    {
        return new Content(
            text: 'mail.platform-admin-setup',
            with: ['setupUrl' => rtrim(config('app.url'), '/').'/account/platform-setup#'.rawurlencode($this->setupUrl())],
        );
    }

    public function setupUrl(): string
    {
        return URL::temporarySignedRoute(
            'platform.setup.show',
            CarbonImmutable::createFromTimestamp($this->expires),
            ['platformAdmin' => $this->admin->getKey(), 'generation' => $this->generation],
        );
    }
}
