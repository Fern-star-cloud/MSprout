<?php

namespace App\Actions\Memberships;

use App\Domain\Audit\AuditEntry;
use App\Domain\Audit\AuditWriter;

class RecordMembershipAudit
{
    public function handle(string $churchId, int $actorId, string $action, string $targetId, ?string $previousOwnerId = null): void
    {
        app(AuditWriter::class)->record(new AuditEntry(
            'church', $action, 'user', (string) $actorId,
            in_array($action, ['teacher.invited', 'invitation.accepted', 'invitation.revoked'], true) ? 'invitation' : 'membership',
            $targetId, churchId: $churchId,
            metadata: array_filter(['risk' => $action === 'ownership.transferred' ? 'high' : 'normal', 'previous_owner_id' => $previousOwnerId], fn ($value) => $value !== null),
        ));
    }
}
