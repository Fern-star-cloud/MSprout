<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class ChurchApplicationDecisionMail extends Mailable implements ShouldBeEncrypted, ShouldQueue
{
    use Queueable;

    public function __construct(public string $decision)
    {
        $this->onConnection('database')->beforeCommit();
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Your MinistrySprout application was '.$this->decision);
    }

    public function send($mailer)
    {
        try {
            return parent::send($mailer);
        } catch (\Throwable) {
            // Queue workers must not report transport exceptions containing recipient details.
            throw new \RuntimeException('Application decision email delivery failed.');
        }
    }

    public function content(): Content
    {
        return new Content(view: 'mail.application-decision', with: ['statusUrl' => rtrim(config('app.url'), '/').'/account/application']);
    }
}
