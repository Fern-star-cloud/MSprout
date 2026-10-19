<?php

namespace App\Domain\Sync;

use App\Models\ChangeFeedEntry;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use LogicException;

/** Supported producer boundary; coordinated execution remains disabled by default. */
final class CoordinatedChangePublisher
{
    public function publish(array $attributes): int
    {
        if (! app(PublicationMode::class)->coordinated()) {
            return (int) ChangeFeedEntry::create($attributes)->sequence;
        }
        $context = app(ChurchCoordination::class)->context();
        if (($attributes['church_id'] ?? null) !== $context->churchId) {
            throw new LogicException('Publication tenant differs from the live authority.');
        }
        $epoch = DB::table('sync_recovery_progress')->where('church_id', $context->churchId)->value('coverage_epoch');
        if (! is_string($epoch)) {
            throw new LogicException('Publication has no qualified coverage epoch.');
        }
        unset($attributes['church_id']);
        $attributes['target_membership_id'] ??= null;

        // Failure propagates through the original domain/receipt transaction. No fallback.
        return $this->append($context, $epoch, $attributes);
    }

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
