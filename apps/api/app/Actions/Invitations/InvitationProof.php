<?php

namespace App\Actions\Invitations;

final class InvitationProof
{
    public function sign(array $proof): string
    {
        return hash_hmac('sha256', implode('|', [$proof['church_id'], $proof['invitation_id'], $proof['token'], $proof['expires']]), config('app.key'));
    }

    public function verify(array $proof): void
    {
        abort_unless((int) $proof['expires'] > now()->timestamp && hash_equals($this->sign($proof), $proof['signature']), 410);
    }
}
