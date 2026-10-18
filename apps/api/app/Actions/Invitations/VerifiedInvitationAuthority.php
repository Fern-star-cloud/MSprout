<?php

namespace App\Actions\Invitations;

use App\Models\Invitation;
use Illuminate\Support\Str;

/** Proof-derived scope only; never constructed from a tenant header or member cache. */
final readonly class VerifiedInvitationAuthority
{
    private function __construct(#[\SensitiveParameter] private array $proof) {}

    public static function verify(#[\SensitiveParameter] array $input): self
    {
        app(InvitationProof::class)->verify($input);

        return new self($input);
    }

    public function churchId(): string
    {
        return Str::lower($this->proof['church_id']);
    }

    public function email(): string
    {
        return Str::lower(trim($this->proof['email']));
    }

    public function current(bool $lock = false): Invitation
    {
        // Must run again after both church and global identity/session waits.
        app(InvitationProof::class)->verify($this->proof);
        $query = Invitation::where('church_id', $this->churchId());
        if ($lock) {
            $query->lockForUpdate();
        }
        $invitation = $query->find($this->proof['invitation_id']);
        abort_unless($invitation && ! $invitation->accepted_at && ! $invitation->revoked_at
            && $invitation->expires_at->isFuture()
            && hash_equals($invitation->token_hash, hash('sha256', $this->proof['token']))
            && hash_equals($invitation->email, $this->email()), 410);

        return $invitation;
    }
}
