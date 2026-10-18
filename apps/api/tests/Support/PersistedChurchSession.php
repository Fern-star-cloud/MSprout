<?php

namespace Tests\Support;

use App\Models\User;
use App\Support\Auth\DatabaseSessionAuthority;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

/** Explicit domain-test fixture. Never automatically re-created before HTTP requests. */
final class PersistedChurchSession
{
    public static function authenticate($test, $actor, string $guard = 'web')
    {
        $test->actingAs($actor, $guard);

        return self::write($test, []);
    }

    public static function write($test, array $claims)
    {
        if (Auth::getDefaultDriver() !== 'web' || Auth::guard('web')->user() === null) {
            return $test->withSession($claims);
        }
        $runtime = DB::connection('pgsql')->getConfig();
        $migration = DB::connection('pgsql_migration')->getConfig();
        if (getenv('APP_ENV') !== 'testing' || $runtime['database'] !== getenv('DB_TEST_DATABASE')
            || $migration['database'] !== $runtime['database'] || $runtime['username'] !== getenv('DB_TEST_RUNTIME_USERNAME')
            || $migration['username'] === $runtime['username']) {
            throw new RuntimeException('Persisted session fixture refuses unverified database configuration.');
        }
        if (config('session.driver') !== 'database') {
            config(['session.driver' => 'database', 'session.connection' => 'pgsql']);
            app('session')->forgetDrivers();
            app()->forgetInstance('session.store');
        }
        $store = app('session.store');
        $actor = Auth::guard('web')->user();
        $oldActor = $store->get(Auth::guard('web')->getName());
        if ((string) $oldActor !== (string) $actor->id) {
            // An explicit fixture identity switch gets a new session; it never
            // overwrites or deletes the previous actor's persisted evidence.
            $store->setId(Str::random(40));
            $store->replace([]);
            $store->regenerateToken();
        }
        $test->withSession($claims);
        $store->put(Auth::guard('web')->getName(), $actor->id);
        if (! array_key_exists('password_hash_web', $claims)) {
            // Explicit fixture admission must bind proof to this actor, never a
            // previous browser identity's password proof. Preserve supplied negatives.
            $store->put('password_hash_web', $actor->getAuthPassword() ?? User::findOrFail($actor->id)->getAuthPassword());
        }
        DB::connection('pgsql_migration')->table(config('session.table'))->updateOrInsert(['id' => $store->getId()], [
            'user_id' => $actor->id, 'payload' => base64_encode(DatabaseSessionAuthority::encode($store->all())),
            'last_activity' => now()->timestamp,
        ]);
        // Framework test cookie preparation applies the actual cookie encryption prefix.
        $test->withCredentials()->withPersistedSessionCookie($store->getId());
        $test->withHeader('Origin', config('app.url'));

        return $test;
    }

    public static function identitySnapshot(): array
    {
        return DB::connection('pgsql_migration')->table(config('session.table'))->orderBy('id')->get()->map(function ($row): array {
            $claims = $row->payload === '' ? [] : DatabaseSessionAuthority::decode(base64_decode($row->payload));
            $authority = DatabaseSessionAuthority::securityClaims($claims);
            $authority['_token'] = $claims['_token'] ?? null;

            return ['session_digest' => hash('sha256', $row->id), 'actor' => $row->user_id,
                'authority_digest' => hash('sha256', json_encode($authority, JSON_THROW_ON_ERROR))];
        })->all();
    }
}
