<?php

namespace App\Http\Controllers;

use App\Domain\Sync\RecoveryCodec;
use App\Domain\Sync\RecoverySnapshots;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class RecoverySnapshotController extends Controller
{
    public function store(Request $request, RecoverySnapshots $snapshots): JsonResponse
    {
        abort_unless(config('recovery.enabled') === true && app()->environment('testing'), 404);
        abort_if(strlen($request->getContent()) > RecoveryCodec::PLAINTEXT + 8192 || $request->allFiles() !== [], 422);
        $base = ['action' => ['required', 'in:begin,manifest,seal'], 'schema' => ['required', 'in:'.RecoveryCodec::SCHEMA], 'device_id' => ['required', 'uuid']];
        $generation = ['recovery_id' => ['required', 'uuid'], 'generation' => ['required', 'uuid']];
        $rules = match ($request->input('action')) {
            'begin' => $base + ['request_id' => ['required', 'uuid'], 'local_generation_id' => ['required', 'uuid']],
            'manifest' => $base + $generation + ['ordinal' => ['required', 'integer', 'min:0', 'max:999'], 'previous_digest' => ['present', 'nullable', 'regex:/\A[a-f0-9]{64}\z/'], 'items' => ['present', 'array', 'max:100']],
            'seal' => $base + $generation + ['input_page_count' => ['required', 'integer', 'min:1', 'max:1000'], 'input_item_count' => ['required', 'integer', 'min:0', 'max:100000'], 'input_manifest_digest' => ['required', 'regex:/\A[a-f0-9]{64}\z/']],
            default => $base,
        };
        abort_if(array_diff(array_keys($request->all()), array_keys($rules)) !== [] || $request->query() !== [], 422);
        $input = $request->validate($rules);
        // Do not coerce JSON lists/ordinals into different original event representations.
        if ($input['action'] === 'manifest') {
            abort_unless(array_is_list($input['items']) && is_int($input['ordinal']), 422);
        }
        // Roll back before Laravel renders an exception into an HTTP response.
        $result = DB::transaction(fn () => match ($input['action']) {
            'begin' => $snapshots->begin($request, $input),
            'manifest' => $snapshots->upload($request, $input),
            'seal' => $snapshots->seal($request, $input),
        });

        return response()->json($result)->header('Cache-Control', 'no-store, private');
    }

    public function show(Request $request, RecoverySnapshots $snapshots): JsonResponse
    {
        abort_unless(config('recovery.enabled') === true && app()->environment('testing'), 404);
        $rules = ['device_id' => ['required', 'uuid'], 'recovery_id' => ['required', 'uuid'], 'generation' => ['required', 'uuid'], 'page' => ['required', 'integer', 'min:0', 'max:9999']];
        abort_if(array_diff(array_keys($request->query()), array_keys($rules)) !== [] || $request->allFiles() !== [] || $request->json()->all() !== [], 422);
        $input = $request->validate($rules);
        $input['page'] = (int) $input['page'];

        return response()->json($snapshots->page($request, $input))->header('Cache-Control', 'no-store, private');
    }
}
