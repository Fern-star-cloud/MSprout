<?php

namespace App\Domain\Sync;

use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/** Dormant boundary. Existing producers deliberately do not call this class. */
final class CoordinatedChangePublisher
{
    public function append(CoordinatedChurchTransaction $context, string $coverageEpoch, array $change): int
    {
        $context->assertUsable();
        $keys = ['ministry_id', 'target_membership_id', 'entity_type', 'entity_id', 'entity_version', 'action', 'payload_json'];
        if (array_diff($keys, array_keys($change)) || array_diff(array_keys($change), $keys)) {
            throw new InvalidArgumentException('Publication requires the supported feed fields only.');
        }

        // No inner transaction, commit, retry, direct-write fallback or fake receipt.
        return (int) DB::scalar('SELECT public.append_coordinated_change(?::uuid,?::uuid,?::text,?::uuid,?::uuid,?::varchar,?::uuid,?::integer,?::varchar,?::jsonb)', [
            $context->churchId, $coverageEpoch, $context->transactionId,
            $change['ministry_id'], $change['target_membership_id'], $change['entity_type'], $change['entity_id'],
            $change['entity_version'], $change['action'], json_encode($change['payload_json'], JSON_THROW_ON_ERROR),
        ]);
    }
}
