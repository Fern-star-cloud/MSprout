<?php

namespace App\Domain\Sync;

use Symfony\Component\HttpKernel\Exception\HttpException;

final class RecoveryException extends HttpException
{
    public function __construct(public readonly string $errorCode = 'recovery_unavailable', int $status = 409)
    {
        parent::__construct($status, 'Recovery preparation could not continue safely. Preserve all saved local work.');
    }
}
