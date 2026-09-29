<?php

namespace App\Http\Controllers;

use App\Domain\Notifications\FindBirthdayRecipients;
use App\Models\Church;
use App\Models\ChurchMembership;
use App\Support\Tenancy\TenantContext;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class BirthdayController extends Controller
{
    public function __invoke(Request $request, FindBirthdayRecipients $finder): JsonResponse
    {
        abort_if($request->query() !== [] || $request->allFiles() !== [], 422);
        $churchId = app(TenantContext::class)->churchId();
        $membership = ChurchMembership::query()
            ->where('church_id', $churchId)
            ->where('user_id', $request->user()->id)
            ->where('status', 'active')
            ->firstOrFail();
        $timezone = Church::query()->whereKey($churchId)->value('timezone');
        $timezone = is_string($timezone) ? $timezone : 'UTC';
        $localDate = CarbonImmutable::now($timezone)->startOfDay();
        $birthdays = $finder->birthdays($membership, $localDate);

        return response()->json(['data' => [
            'local_date' => $localDate->toDateString(),
            'timezone' => $timezone,
            'role' => $membership->role->value,
            'count' => count($birthdays),
            'birthdays' => $birthdays,
        ]])->header('Cache-Control', 'no-store, private');
    }
}
