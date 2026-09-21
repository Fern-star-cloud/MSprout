<?php

namespace App\Actions\Memberships;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RecordMembershipAudit
{
    public function handle(string $churchId, int $actorId, string $action, string $targetId, ?string $previousOwnerId = null): void
    {
        $correlation = request()->header('X-Correlation-Id');
        DB::table('membership_audits')->insert([
            'id' => (string) Str::uuid(), 'church_id' => $churchId, 'actor_id' => $actorId,
            'action' => $action, 'target_id' => $targetId, 'previous_owner_id' => $previousOwnerId,
            'risk' => $action === 'ownership.transferred' ? 'high' : 'normal', 'result' => 'success',
            'correlation_id' => Str::isUuid($correlation) ? $correlation : (string) Str::uuid(), 'occurred_at' => now(),
        ]);
    }
}
