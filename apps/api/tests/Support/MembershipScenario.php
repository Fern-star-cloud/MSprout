<?php

namespace Tests\Support;

use App\Mail\TeacherInvitationMail;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Laravel\Fortify\Fortify;
use PragmaRX\Google2FA\Google2FA;

final class MembershipScenario
{
    public static function owner($test): array
    {
        [$owner, $church, $membership] = ChurchScenario::owner();
        $owner = User::findOrFail($owner->id);
        $test->password = Str::password(32);
        $test->secret = (new Google2FA)->generateSecretKey();
        $owner->forceFill(['password' => Hash::make($test->password), 'two_factor_secret' => Fortify::currentEncrypter()->encrypt($test->secret), 'two_factor_confirmed_at' => now()])->save();
        $test->actingAs($owner)->withHeader('Origin', config('app.url'))->withHeader('X-Church-Id', $church->id)->withSession(['church_mfa_user_id' => $owner->id]);

        return [$owner, $church, $membership];
    }

    public static function ministry(string $churchId): string
    {
        $id = (string) Str::uuid();
        DB::connection('pgsql_migration')->table('ministries')->insert(['id' => $id, 'church_id' => $churchId, 'name' => 'Test ministry', 'created_at' => now(), 'updated_at' => now()]);

        return $id;
    }

    public static function proof(): array
    {
        return Mail::sent(TeacherInvitationMail::class)->last()->proof;
    }

    public static function deviceAccess($membership): void
    {
        $db = DB::connection('pgsql_migration');
        $db->table('sessions')->insert(['id' => Str::random(40), 'user_id' => $membership->user_id, 'payload' => '', 'last_activity' => time()]);
        foreach (['offline_authorizations', 'push_subscriptions'] as $table) {
            $db->table($table)->insert(['id' => (string) Str::uuid(), 'church_id' => $membership->church_id, 'membership_id' => $membership->id, 'device_id' => (string) Str::uuid(), 'expires_at' => now()->addDays(14)]);
        }
    }
}
