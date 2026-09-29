<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $schema = Schema::connection($this->getConnection());
        $db = DB::connection($this->getConnection());
        $role = config('database.runtime_role');
        if (! is_string($role) || ! preg_match('/\A[a-z_][a-z0-9_]*\z/', $role)) {
            throw new RuntimeException('Invalid runtime role.');
        }

        $schema->table('church_memberships', function (Blueprint $table): void {
            $table->unique(['church_id', 'id', 'user_id'], 'church_memberships_tenant_id_user_unique');
        });
        $schema->table('push_subscriptions', function (Blueprint $table): void {
            $table->foreignId('user_id')->nullable()->after('membership_id')->constrained('users');
            $table->char('endpoint_hash', 64)->nullable()->after('device_id');
            $table->text('endpoint_ciphertext')->nullable()->after('endpoint_hash');
            $table->text('p256dh_ciphertext')->nullable()->after('endpoint_ciphertext');
            $table->text('auth_ciphertext')->nullable()->after('p256dh_ciphertext');
            $table->string('content_encoding', 16)->default('aes128gcm')->after('auth_ciphertext');
            $table->string('permission_state', 16)->default('granted')->after('content_encoding');
            $table->timestampTz('last_success_at')->nullable()->after('permission_state');
            $table->unsignedSmallInteger('failure_count')->default(0)->after('last_success_at');
            $table->timestampsTz();
            $table->unique(['church_id', 'id']);
            $table->unique(
                ['church_id', 'id', 'membership_id', 'user_id', 'device_id'],
                'push_subscriptions_delivery_identity_unique',
            );
            $table->foreign(
                ['church_id', 'membership_id', 'user_id'],
                'push_subscriptions_membership_user_foreign',
            )->references(['church_id', 'id', 'user_id'])->on('church_memberships');
        });
        $db->statement('ALTER TABLE push_subscriptions ALTER COLUMN expires_at DROP NOT NULL');
        $db->statement("ALTER TABLE push_subscriptions ADD CHECK (permission_state IN ('granted', 'denied')), ADD CHECK (content_encoding IN ('aes128gcm', 'aesgcm'))");
        $db->statement('CREATE UNIQUE INDEX push_subscriptions_active_endpoint_unique ON push_subscriptions (church_id, endpoint_hash) WHERE revoked_at IS NULL AND endpoint_hash IS NOT NULL');

        $schema->create('birthday_notification_dispatches', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('church_id');
            $table->date('local_date');
            $table->timestampTz('dispatched_at');
            $table->foreign('church_id')->references('id')->on('churches');
            $table->unique(['church_id', 'local_date']);
            $table->unique(['church_id', 'id']);
        });
        $schema->create('birthday_notification_deliveries', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('church_id');
            $table->date('local_date');
            $table->foreignId('user_id')->constrained('users');
            $table->uuid('membership_id');
            $table->uuid('device_id');
            $table->uuid('push_subscription_id');
            $table->unsignedInteger('birthday_count');
            $table->string('status', 16)->default('pending');
            $table->unsignedSmallInteger('attempt_count')->default(0);
            $table->timestampTz('last_attempt_at')->nullable();
            $table->timestampTz('delivered_at')->nullable();
            $table->string('failure_category', 32)->nullable();
            $table->timestampsTz();
            $table->foreign(
                ['church_id', 'membership_id', 'user_id'],
                'birthday_deliveries_membership_user_foreign',
            )->references(['church_id', 'id', 'user_id'])->on('church_memberships');
            $table->foreign(
                ['church_id', 'push_subscription_id', 'membership_id', 'user_id', 'device_id'],
                'birthday_deliveries_subscription_identity_foreign',
            )->references(['church_id', 'id', 'membership_id', 'user_id', 'device_id'])->on('push_subscriptions');
            $table->unique(['church_id', 'local_date', 'user_id', 'device_id'], 'birthday_delivery_recipient_unique');
            $table->unique(['church_id', 'id']);
        });
        $db->statement("ALTER TABLE birthday_notification_deliveries ADD CHECK (status IN ('pending', 'sending', 'delivered', 'failed', 'revoked')), ADD CHECK (birthday_count > 0)");

        foreach (['birthday_notification_dispatches', 'birthday_notification_deliveries'] as $table) {
            $db->unprepared("ALTER TABLE {$table} ENABLE ROW LEVEL SECURITY;
                ALTER TABLE {$table} FORCE ROW LEVEL SECURITY;
                CREATE POLICY {$table}_tenant ON {$table}
                USING (church_id = NULLIF(current_setting('app.current_church_id', true), '')::uuid)
                WITH CHECK (church_id = NULLIF(current_setting('app.current_church_id', true), '')::uuid);
                REVOKE ALL ON {$table} FROM PUBLIC;
                GRANT SELECT, INSERT ON {$table} TO \"{$role}\";");
        }
        $db->unprepared("GRANT UPDATE ON birthday_notification_deliveries TO \"{$role}\"");
        $db->unprepared(<<<SQL
            CREATE OR REPLACE FUNCTION due_birthday_churches(at_utc timestamptz)
            RETURNS TABLE (church_id uuid, local_date date)
            LANGUAGE sql
            STABLE
            SECURITY DEFINER
            SET search_path = pg_catalog
            AS \$\$
                SELECT c.id, timezone(c.timezone, at_utc)::date
                FROM public.churches c
                WHERE c.status = 'active'
                  AND to_char(timezone(c.timezone, at_utc), 'HH24:MI') = '08:00'
                  AND NOT EXISTS (
                      SELECT 1 FROM public.birthday_notification_dispatches d
                      WHERE d.church_id = c.id
                        AND d.local_date = timezone(c.timezone, at_utc)::date
                  )
                ORDER BY c.id
            \$\$;
            REVOKE ALL ON FUNCTION due_birthday_churches(timestamptz) FROM PUBLIC;
            GRANT EXECUTE ON FUNCTION due_birthday_churches(timestamptz) TO "{$role}";
            SQL);
    }

    public function down(): void
    {
        $schema = Schema::connection($this->getConnection());
        DB::connection($this->getConnection())->unprepared('DROP FUNCTION IF EXISTS due_birthday_churches(timestamptz)');
        $schema->dropIfExists('birthday_notification_deliveries');
        $schema->dropIfExists('birthday_notification_dispatches');
        $schema->table('push_subscriptions', function (Blueprint $table): void {
            $table->dropForeign('push_subscriptions_membership_user_foreign');
            $table->dropUnique('push_subscriptions_delivery_identity_unique');
            $table->dropUnique(['church_id', 'id']);
            $table->dropConstrainedForeignId('user_id');
            $table->dropColumn([
                'endpoint_hash', 'endpoint_ciphertext', 'p256dh_ciphertext', 'auth_ciphertext',
                'content_encoding', 'permission_state', 'last_success_at', 'failure_count',
                'created_at', 'updated_at',
            ]);
        });
        $schema->table('church_memberships', function (Blueprint $table): void {
            $table->dropUnique('church_memberships_tenant_id_user_unique');
        });
    }
};
