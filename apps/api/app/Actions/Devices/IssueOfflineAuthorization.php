<?php

namespace App\Actions\Devices;

use App\Domain\Audit\AuditEntry;
use App\Domain\Audit\AuditWriter;
use App\Models\ChurchMembership;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

final class IssueOfflineAuthorization
{
    public function handle(ChurchMembership $membership, string $deviceId): array
    {
        return DB::transaction(fn (): array => $this->issue($membership, $deviceId));
    }

    private function issue(ChurchMembership $membership, string $deviceId): array
    {
        $issuedAt = now('UTC');
        $expiresAt = $issuedAt->copy()->addDays(14);
        $id = (string) Str::uuid();

        DB::table('offline_authorizations')->upsert([[
            'id' => $id,
            'church_id' => $membership->church_id,
            'membership_id' => $membership->id,
            'device_id' => $deviceId,
            'expires_at' => $expiresAt,
            'revoked_at' => null,
        ]], ['membership_id', 'device_id'], ['expires_at', 'revoked_at']);

        $authorization = DB::table('offline_authorizations')
            ->where('church_id', $membership->church_id)
            ->where('membership_id', $membership->id)
            ->where('device_id', $deviceId)
            ->whereNull('revoked_at')
            ->firstOrFail();

        $lease = [
            'actor_id' => (string) $membership->user_id,
            'church_id' => $membership->church_id,
            'membership_id' => $membership->id,
            'device_id' => $deviceId,
            'issued_at' => $issuedAt->toISOString(),
            'expires_at' => $expiresAt->toISOString(),
        ];
        $key = config('app.key');
        if (! is_string($key) || $key === '') {
            throw new RuntimeException('Application signing key is unavailable.');
        }
        $lease['signature'] = hash_hmac('sha256', json_encode($lease, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES), $key);

        app(AuditWriter::class)->record(new AuditEntry(
            'church',
            'offline.authorization.issued',
            'user',
            (string) $membership->user_id,
            'system',
            $authorization->id,
            'success',
            $membership->church_id,
            $deviceId,
        ));

        return $lease;
    }
}
