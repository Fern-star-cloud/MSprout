<?php

namespace App\Domain\Sync;

use PDO;

/** A callback-scoped capability; constructing another object does not register it. */
final readonly class CoordinatedChurchTransaction
{
    public function __construct(
        private ChurchCoordination $owner,
        public PDO $connection,
        public string $churchId,
        public int $backendPid,
        public string $transactionId,
    ) {}

    public function assertUsable(): void
    {
        $this->owner->assertContext($this);
    }
}
