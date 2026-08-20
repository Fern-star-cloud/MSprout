<?php

namespace Tests\Support;

use App\Models\Church;
use App\Models\ChurchMembership;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

final class ChurchScenario
{
    /**
     * @return array{User, Church, ChurchMembership}
     */
    public static function owner(): array
    {
        return DB::connection('pgsql_migration')->transaction(function (): array {
            $user = self::insertUser();
            $churchId = (string) Str::uuid();
            $membershipId = (string) Str::uuid();

            DB::connection('pgsql_migration')->table('churches')->insert([
                'id' => $churchId,
                'name' => 'Church '.Str::lower(Str::random(8)),
                'slug' => 'church-'.Str::lower(Str::random(12)),
                'timezone' => 'Asia/Manila',
                'status' => 'active',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::connection('pgsql_migration')->table('church_memberships')->insert([
                'id' => $membershipId,
                'church_id' => $churchId,
                'user_id' => $user->getKey(),
                'role' => 'owner',
                'status' => 'active',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return [
                $user,
                self::churchModel($churchId),
                self::membershipModel($membershipId, $churchId, (int) $user->getKey(), 'owner', 'active'),
            ];
        });
    }

    /**
     * @return array{User, ChurchMembership}
     */
    public static function teacher(Church $church, string $status = 'active'): array
    {
        return DB::connection('pgsql_migration')->transaction(function () use ($church, $status): array {
            $user = self::insertUser();
            $membershipId = (string) Str::uuid();

            DB::connection('pgsql_migration')->table('church_memberships')->insert([
                'id' => $membershipId,
                'church_id' => $church->getKey(),
                'user_id' => $user->getKey(),
                'role' => 'teacher',
                'status' => $status,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return [
                $user,
                self::membershipModel(
                    $membershipId,
                    (string) $church->getKey(),
                    (int) $user->getKey(),
                    'teacher',
                    $status,
                ),
            ];
        });
    }

    public static function user(): User
    {
        return DB::connection('pgsql_migration')->transaction(
            static fn (): User => self::insertUser(),
        );
    }

    private static function insertUser(): User
    {
        $id = DB::connection('pgsql_migration')->table('users')->insertGetId([
            'name' => 'Test User',
            'email' => Str::uuid().'@example.test',
            'email_verified_at' => now(),
            'password' => Hash::make(Str::password(32)),
            'remember_token' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $user = new User;
        $user->setConnection('pgsql');
        $user->forceFill(['id' => $id, 'name' => 'Test User']);
        $user->exists = true;

        return $user;
    }

    private static function churchModel(string $churchId): Church
    {
        $church = new Church;
        $church->setConnection('pgsql');
        $church->forceFill(['id' => $churchId, 'status' => 'active']);
        $church->exists = true;

        return $church;
    }

    private static function membershipModel(
        string $membershipId,
        string $churchId,
        int $userId,
        string $role,
        string $status,
    ): ChurchMembership {
        $membership = new ChurchMembership;
        $membership->setConnection('pgsql');
        $membership->forceFill([
            'id' => $membershipId,
            'church_id' => $churchId,
            'user_id' => $userId,
            'role' => $role,
            'status' => $status,
        ]);
        $membership->exists = true;

        return $membership;
    }
}
