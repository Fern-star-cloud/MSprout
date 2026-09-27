<?php

namespace App\Domain\Audit;

use Illuminate\Support\Str;

final class CorrelationContext
{
    private ?string $id = null;

    public function start(?string $id = null): string
    {
        return $this->id = Str::isUuid($id) ? strtolower($id) : (string) Str::uuid();
    }

    public function id(): string
    {
        return $this->id ?? $this->start();
    }

    public function clear(): void
    {
        $this->id = null;
    }
}
