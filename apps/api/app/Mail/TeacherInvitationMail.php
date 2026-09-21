<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use RuntimeException;
use Throwable;

class TeacherInvitationMail extends Mailable
{
    public function __construct(public array $proof) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Your MinistrySprout Teacher invitation');
    }

    public function content(): Content
    {
        return new Content(view: 'mail.teacher-invitation', with: [
            'link' => rtrim(config('app.url'), '/').'/account/teacher-invitation#'.rawurlencode(json_encode($this->proof, JSON_THROW_ON_ERROR)),
        ]);
    }

    public function send($mailer)
    {
        try {
            return parent::send($mailer);
        } catch (Throwable) {
            throw new RuntimeException('Teacher invitation delivery failed.');
        }
    }
}
