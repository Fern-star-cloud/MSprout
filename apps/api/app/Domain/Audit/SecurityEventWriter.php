<?php

namespace App\Domain\Audit;

use App\Models\SecurityEvent;

class SecurityEventWriter
{
    public function record(string $action, string $result, string $actorType = 'anonymous', ?string $actorId = null, ?string $churchId = null): void
    {
        $event = new AuditEntry('security', $action, $actorType, $actorId, $actorType === 'anonymous' ? 'session' : $actorType, $actorId, $result, $churchId);
        SecurityEvent::create(app(AuditWriter::class)->attributes($event));
    }
}
