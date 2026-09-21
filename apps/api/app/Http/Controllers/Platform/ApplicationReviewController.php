<?php

namespace App\Http\Controllers\Platform;

use App\Actions\Applications\ApproveChurchApplication;
use App\Actions\Applications\RejectChurchApplication;
use App\Http\Controllers\Controller;
use App\Models\ChurchApplication;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class ApplicationReviewController extends Controller
{
    public function index(Request $request)
    {
        $data = $request->validate(['status' => ['sometimes', Rule::in(['pending', 'approved', 'rejected'])], 'page' => ['sometimes', 'integer', 'min:1', 'max:100000']]);
        $page = ChurchApplication::query()->whereNull('purged_at')->where('status', $data['status'] ?? 'pending')->orderBy('created_at')->orderBy('id')->paginate(20);

        return response()->json(['data' => $page->getCollection()->map(fn ($application) => $application->projection()), 'page' => $page->currentPage(), 'has_more' => $page->hasMorePages()]);
    }

    public function show(string $id)
    {
        return response()->json(ChurchApplication::query()->whereNull('purged_at')->findOrFail($id)->projection());
    }

    public function approve(Request $request, string $id, ApproveChurchApplication $action)
    {
        abort_if($request->all() !== [], 422);

        return response()->json($action->handle($id, $request->user('platform')->id, $request->header('X-Correlation-Id'))->projection());
    }

    public function reject(Request $request, string $id, RejectChurchApplication $action)
    {
        abort_if(array_diff(array_keys($request->all()), ['category', 'reason']) !== [], 422);
        $data = $request->validate(['category' => ['required', Rule::in(['duplicate', 'ineligible', 'incomplete', 'other'])], 'reason' => ['required', 'string', 'max:500']]);
        $data['reason'] = trim(preg_replace('/[\p{C}\p{Z}\s]+/u', ' ', strip_tags($data['reason'])));
        abort_if($data['reason'] === '', 422);

        return response()->json($action->handle($id, $request->user('platform')->id, $request->header('X-Correlation-Id'), $data)->projection());
    }
}
