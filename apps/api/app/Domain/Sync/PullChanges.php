<?php

namespace App\Domain\Sync;

use App\Enums\ChurchRole;
use App\Models\ChangeFeedEntry;
use App\Models\ChurchMembership;
use App\Models\DeviceCursor;
use Illuminate\Support\Facades\DB;

final class PullChanges
{
    /** @return array{changes: array<int, array<string, mixed>>, page: array{next_cursor: string, has_more: bool}} */
    public function handle(ChurchMembership $membership, string $deviceId, int $cursor, int $limit): array
    {
        $rows = ChangeFeedEntry::query()
            ->where('church_id', $membership->church_id)
            ->where('sequence', '>', $cursor)
            ->orderBy('sequence')
            ->limit($limit + 1)
            ->get();
        $hasMore = $rows->count() > $limit;
        $page = $rows->take($limit);
        $nextCursor = (int) ($page->last()?->sequence ?? $cursor);

        $assigned = $membership->role === ChurchRole::Owner ? null : DB::table('teacher_ministry_assignments')
            ->where('church_id', $membership->church_id)
            ->where('membership_id', $membership->id)
            ->whereNull('revoked_at')
            ->pluck('ministry_id')
            ->all();
        $changes = $page->filter(function (ChangeFeedEntry $entry) use ($membership, $assigned): bool {
            if ($entry->target_membership_id !== null) {
                return $entry->target_membership_id === $membership->id;
            }

            return $assigned === null || ($entry->ministry_id !== null && in_array($entry->ministry_id, $assigned, true));
        })->map(fn (ChangeFeedEntry $entry): array => [
            'sequence' => (string) $entry->sequence,
            'entity_type' => $entry->entity_type,
            'entity_id' => $entry->entity_id,
            'version' => $entry->entity_version,
            'action' => $entry->action,
            'ministry_id' => $entry->ministry_id,
            'payload' => $entry->payload_json,
        ])->values()->all();

        $deviceCursor = DeviceCursor::query()
            ->where('membership_id', $membership->id)
            ->where('device_id', $deviceId)
            ->lockForUpdate()
            ->first();
        if ($deviceCursor === null) {
            DeviceCursor::create([
                'church_id' => $membership->church_id,
                'membership_id' => $membership->id,
                'device_id' => $deviceId,
                'cursor' => $nextCursor,
                'updated_at' => now('UTC'),
            ]);
        } elseif ((int) $deviceCursor->cursor < $nextCursor) {
            $deviceCursor->forceFill(['cursor' => $nextCursor, 'updated_at' => now('UTC')])->save();
        }

        return [
            'changes' => $changes,
            'page' => ['next_cursor' => (string) $nextCursor, 'has_more' => $hasMore],
        ];
    }
}
