<?php

namespace App\Http\Controllers;

use App\Models\AuditEvent;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\Request;

final class AuditController extends Controller
{
    public function church(Request $request, TenantContext $tenant)
    {
        $scope = $tenant->role()->value === 'owner' ? 'church' : 'own';
        $query = AuditEvent::query()->where('category', 'church')->where('church_id', $tenant->churchId());
        if ($scope === 'own') {
            $query->where('actor_type', 'user')->where('actor_id', (string) $request->user('web')->id)
                ->whereIn('action', ['submission.accepted', 'submission.rejected', 'sync.accepted', 'sync.rejected', 'sync.conflict']);
        }

        return $this->page($request, $query, $scope);
    }

    public function platform(Request $request)
    {
        return $this->page($request, AuditEvent::query()->where('category', 'platform')->whereNull('church_id'), 'platform');
    }

    private function page(Request $request, $query, string $scope)
    {
        abort_if(array_diff(array_keys($request->query()), ['page', 'per_page']) !== [], 422);
        $data = $request->validate(['page' => ['sometimes', 'integer', 'min:1', 'max:10000'], 'per_page' => ['sometimes', 'integer', 'min:1', 'max:100']]);
        $page = (int) ($data['page'] ?? 1);
        $size = (int) ($data['per_page'] ?? 25);
        $rows = $query->select(['id', 'category', 'action', 'result', 'actor_type', 'actor_id', 'target_type', 'target_id', 'correlation_id', 'occurred_at'])
            ->orderByDesc('occurred_at')->orderByDesc('id')->offset(($page - 1) * $size)->limit($size + 1)->get();

        return response()->json(['data' => $rows->take($size)->values(), 'page' => $page, 'per_page' => $size, 'has_more' => $rows->count() > $size, 'scope' => $scope]);
    }
}
