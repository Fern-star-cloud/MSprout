<?php

namespace App\Domain\Audit;

final readonly class AuditEntry
{
    public function __construct(
        public string $category,
        public string $action,
        public string $actorType,
        public ?string $actorId,
        public string $targetType,
        public ?string $targetId,
        public string $result = 'success',
        public ?string $churchId = null,
        public ?string $deviceId = null,
        public ?string $syncBatchId = null,
        public array $metadata = [],
        public ?string $correlationId = null,
    ) {}
}
