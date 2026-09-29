<?php

namespace App\Http\Controllers;

use App\Actions\Devices\IssueOfflineAuthorization;
use App\Domain\Sync\ApplySyncBatch;
use App\Domain\Sync\PullChanges;
use App\Domain\Sync\SyncAuthorization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class SyncController extends Controller
{
    public function push(Request $request, SyncAuthorization $authorization, ApplySyncBatch $apply): JsonResponse
    {
        abort_if(array_diff(array_keys($request->all()), ['device_id', 'batch_id', 'events']) !== [] || $request->allFiles() !== [], 422);
        $input = $request->validate([
            'device_id' => ['required', 'uuid'],
            'batch_id' => ['required', 'uuid'],
            'events' => ['required', 'array', 'min:1', 'max:100'],
            'events.*' => ['required', 'array:client_event_id,entity_id,action,base_version,occurred_at,payload'],
            'events.*.client_event_id' => ['required', 'uuid'],
            'events.*.entity_id' => ['required', 'uuid'],
            'events.*.action' => ['required', 'string', 'max:64'],
            'events.*.base_version' => ['required', 'integer', 'min:0', 'max:2147483647'],
            'events.*.occurred_at' => ['required', 'date'],
            'events.*.payload' => ['present', 'array'],
        ]);
        $membership = $authorization->membership($request, $input['device_id']);

        return response()->json([
            'results' => $apply->handle($membership, $input['device_id'], $input['batch_id'], $input['events'], $request->user()),
        ]);
    }

    public function pull(
        Request $request,
        SyncAuthorization $authorization,
        PullChanges $pull,
        IssueOfflineAuthorization $issue,
    ): JsonResponse {
        abort_if(array_diff(array_keys($request->query()), ['cursor', 'limit']) !== [] || $request->allFiles() !== [], 422);
        $input = $request->validate([
            'cursor' => ['sometimes', 'regex:/^\d{1,20}$/'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);
        $deviceId = $request->header('X-Device-Id');
        abort_unless(is_string($deviceId) && preg_match('/\A[0-9a-f-]{36}\z/i', $deviceId), 422);
        $cursor = filter_var($input['cursor'] ?? '0', FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]]);
        abort_if($cursor === false, 422);
        $membership = $authorization->membership($request, $deviceId);
        $result = $pull->handle($membership, $deviceId, $cursor, (int) ($input['limit'] ?? 100));
        $result['lease'] = $issue->handle($membership, $deviceId);

        return response()->json($result);
    }
}
