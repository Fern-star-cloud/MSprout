<?php

namespace App\Http\Controllers;

use App\Domain\Audit\AuditEntry;
use App\Domain\Audit\AuditWriter;
use App\Models\ChurchMembership;
use App\Models\PushSubscription;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

final class PushSubscriptionController extends Controller
{
    public function config(Request $request): JsonResponse
    {
        abort_if($request->query() !== [] || $request->allFiles() !== [], 422);
        $key = config('services.webpush.public_key');

        return response()->json([
            'vapid_public_key' => is_string($key) ? $key : '',
            'configured' => is_string($key) && $key !== '',
        ])->header('Cache-Control', 'no-store, private');
    }

    public function store(Request $request, AuditWriter $audit): JsonResponse
    {
        abort_if(array_diff(array_keys($request->all()), ['device_id', 'permission', 'subscription']) !== [], 422);
        $data = $request->validate([
            'device_id' => ['required', 'uuid'],
            'permission' => ['required', Rule::in(['granted'])],
            'subscription' => ['required', 'array:'.implode(',', ['endpoint', 'expirationTime', 'keys'])],
            'subscription.endpoint' => [
                'required', 'url:https', 'max:2048',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if (! is_string($value) || ! $this->isTrustedPushEndpoint($value)) {
                        $fail('The push endpoint is not supported.');
                    }
                },
            ],
            'subscription.expirationTime' => ['nullable', 'integer', 'min:0'],
            'subscription.keys' => ['required', 'array:p256dh,auth'],
            'subscription.keys.p256dh' => ['required', 'string', 'min:8', 'max:512'],
            'subscription.keys.auth' => ['required', 'string', 'min:8', 'max:256'],
        ]);
        $churchId = app(TenantContext::class)->churchId();
        $membership = ChurchMembership::query()
            ->where('church_id', $churchId)->where('user_id', $request->user()->id)
            ->where('status', 'active')->lockForUpdate()->firstOrFail();
        $endpoint = $data['subscription']['endpoint'];
        $endpointHash = hash('sha256', $endpoint);

        DB::table('push_subscriptions')->where('church_id', $churchId)
            ->where('endpoint_hash', $endpointHash)
            ->where(function ($query) use ($membership, $data): void {
                $query->where('membership_id', '!=', $membership->id)
                    ->orWhere('device_id', '!=', $data['device_id']);
            })->whereNull('revoked_at')->update(['revoked_at' => now(), 'updated_at' => now()]);

        $subscription = PushSubscription::query()->updateOrCreate(
            ['church_id' => $churchId, 'membership_id' => $membership->id, 'device_id' => $data['device_id']],
            [
                'user_id' => $request->user()->id,
                'endpoint_hash' => $endpointHash,
                'endpoint_ciphertext' => Crypt::encryptString($endpoint),
                'p256dh_ciphertext' => Crypt::encryptString($data['subscription']['keys']['p256dh']),
                'auth_ciphertext' => Crypt::encryptString($data['subscription']['keys']['auth']),
                'content_encoding' => 'aes128gcm',
                'permission_state' => 'granted',
                'expires_at' => $data['subscription']['expirationTime'] === null
                    ? null : now()->setTimestampMs($data['subscription']['expirationTime']),
                'failure_count' => 0,
                'revoked_at' => null,
            ],
        );
        $audit->record(new AuditEntry(
            'church', 'birthday.push.registered', 'user', (string) $request->user()->id,
            'system', null, churchId: $churchId, deviceId: $data['device_id'],
        ));

        return response()->json([
            'device_id' => $subscription->device_id,
            'permission' => $subscription->permission_state,
        ], 201)->header('Cache-Control', 'no-store, private');
    }

    public function destroy(Request $request, string $deviceId, AuditWriter $audit): Response
    {
        abort_if($request->query() !== [] || $request->allFiles() !== [], 422);
        $churchId = app(TenantContext::class)->churchId();
        $membership = ChurchMembership::query()
            ->where('church_id', $churchId)->where('user_id', $request->user()->id)
            ->where('status', 'active')->firstOrFail();
        PushSubscription::query()->where('church_id', $churchId)
            ->where('membership_id', $membership->id)->where('device_id', $deviceId)
            ->whereNull('revoked_at')->update(['permission_state' => 'denied', 'revoked_at' => now()]);
        $audit->record(new AuditEntry(
            'church', 'birthday.push.revoked', 'user', (string) $request->user()->id,
            'system', null, churchId: $churchId, deviceId: $deviceId,
        ));

        return response()->noContent();
    }

    private function isTrustedPushEndpoint(string $endpoint): bool
    {
        $parts = parse_url($endpoint);
        if (! is_array($parts) || ($parts['scheme'] ?? null) !== 'https'
            || isset($parts['user']) || isset($parts['pass']) || isset($parts['fragment'])
            || (isset($parts['port']) && $parts['port'] !== 443)) {
            return false;
        }
        $host = strtolower($parts['host'] ?? '');
        $exact = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'push.services.mozilla.com'];
        $suffixes = ['.push.apple.com', '.notify.windows.com', '.wns.windows.com'];

        return in_array($host, $exact, true) || Str::endsWith($host, $suffixes);
    }
}
