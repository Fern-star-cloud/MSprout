<?php

namespace App\Mail;

use App\Models\PlatformAdmin;
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

    public function __construct(public readonly PlatformAdmin $admin) {}

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
            $this->admin->setup_expires_at,
            ['platformAdmin' => $this->admin->getKey()],
        );
    }
}
