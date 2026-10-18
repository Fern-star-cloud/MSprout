<?php

namespace App\Domain\Sync;

use App\Models\ChurchMembership;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/** Server-owned participant discovery, before any global User lock. */
final class MemberCoordinationIntent
{
    public static function participants(Request $request, string $churchId, int $actorId): array
    {
        $transfer = $request->is('api/ownership-transfer') && $request->isMethod('POST');
        $changesAccess = $request->is('api/teachers/*') && in_array($request->method(), ['PUT', 'DELETE'], true);
        $participants = [$actorId => $transfer ? 'write' : 'read'];
        if ($transfer || $changesAccess) {
            abort_unless(ChurchMembership::where('church_id', $churchId)->where('user_id', $actorId)
                ->where('role', 'owner')->where('status', 'active')->exists(), 403);
            $id = $transfer ? $request->input('target_membership_id') : $request->route('id');
            if (is_string($id) && Str::isUuid($id)) {
                $target = ChurchMembership::query()->where('church_id', $churchId)->whereKey($id)
                    ->where('role', 'teacher')->where('status', 'active')->value('user_id');
                if ($target !== null) {
                    $participants[(int) $target] = 'write';
                }
            }
        }

        return $participants;
    }
}
