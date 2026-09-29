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

        $schema->create('operational_events', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('event_type', 64);
            $table->string('severity', 16);
            $table->uuid('correlation_id')->nullable();
            $table->jsonb('metadata_json')->default('{}');
            $table->timestampTz('occurred_at');
            $table->index(['event_type', 'occurred_at']);
            $table->index('occurred_at');
        });
        $db->statement("ALTER TABLE operational_events ADD CHECK (event_type ~ '^[a-z][a-z0-9_.]{1,63}$'), ADD CHECK (severity IN ('info', 'warning', 'error')), ADD CHECK (jsonb_typeof(metadata_json) = 'object')");

        $schema->create('system_heartbeats', function (Blueprint $table): void {
            $table->string('name', 32)->primary();
            $table->string('status', 16);
            $table->timestampTz('last_run_at');
            $table->timestampTz('updated_at');
        });
        $db->statement("ALTER TABLE system_heartbeats ADD CHECK (name IN ('scheduler')), ADD CHECK (status IN ('ok', 'failed'))");

        $schema->table('device_cursors', function (Blueprint $table): void {
            $table->boolean('full_resync_required')->default(false);
        });

        $db->unprepared("REVOKE ALL ON operational_events, system_heartbeats FROM PUBLIC;
            REVOKE ALL ON operational_events, system_heartbeats FROM \"{$role}\";");

        $db->unprepared(<<<SQL
            CREATE OR REPLACE FUNCTION record_system_heartbeat(
                heartbeat_name text,
                heartbeat_status text,
                ran_at timestamptz,
                event_id uuid,
                correlation uuid
            ) RETURNS void
            LANGUAGE plpgsql
            SECURITY DEFINER
            SET search_path = pg_catalog
            AS \$\$
            DECLARE database_bytes bigint;
            BEGIN
                IF heartbeat_name <> 'scheduler' OR heartbeat_status NOT IN ('ok', 'failed')
                    OR ran_at > clock_timestamp() + interval '1 minute'
                    OR ran_at < clock_timestamp() - interval '10 minutes' THEN
                    RAISE EXCEPTION 'Invalid heartbeat';
                END IF;
                database_bytes := pg_database_size(current_database());
                INSERT INTO public.system_heartbeats (name, status, last_run_at, updated_at)
                VALUES (heartbeat_name, heartbeat_status, ran_at, clock_timestamp())
                ON CONFLICT (name) DO UPDATE SET
                    status = excluded.status,
                    last_run_at = excluded.last_run_at,
                    updated_at = excluded.updated_at;
                INSERT INTO public.operational_events (id, event_type, severity, correlation_id, metadata_json, occurred_at)
                VALUES (event_id, 'scheduler.heartbeat', CASE WHEN heartbeat_status = 'ok' THEN 'info' ELSE 'error' END,
                    correlation, jsonb_build_object('database_bytes', database_bytes), ran_at);
            END
            \$\$;

            CREATE OR REPLACE FUNCTION system_health_metrics(queue_warning_seconds integer, scheduler_warning_seconds integer)
            RETURNS jsonb
            LANGUAGE plpgsql
            SECURITY DEFINER
            SET search_path = pg_catalog
            AS \$\$
            DECLARE
                tenant record;
                previous_scope text := current_setting('app.current_church_id', true);
                pending_count bigint;
                oldest_age bigint;
                failed_count bigint;
                scheduler_at timestamptz;
                birthday_at timestamptz;
                tenant_birthday_at timestamptz;
                birthday_failed bigint := 0;
                birthday_stale bigint := 0;
                sync_count bigint := 0;
                sync_rejected bigint := 0;
                conflict_count bigint := 0;
                database_bytes bigint;
                previous_bytes bigint;
                queue_status text;
                scheduler_status text;
                birthday_status text;
                sync_status text;
                overall_status text;
            BEGIN
                IF queue_warning_seconds NOT BETWEEN 30 AND 86400 OR scheduler_warning_seconds NOT BETWEEN 60 AND 86400 THEN
                    RAISE EXCEPTION 'Invalid health threshold';
                END IF;

                SELECT count(*), COALESCE(EXTRACT(EPOCH FROM (clock_timestamp() - to_timestamp(min(created_at))))::bigint, 0)
                    INTO pending_count, oldest_age FROM public.jobs;
                SELECT count(*) INTO failed_count FROM public.failed_jobs WHERE failed_at >= clock_timestamp() - interval '24 hours';
                SELECT last_run_at INTO scheduler_at FROM public.system_heartbeats WHERE name = 'scheduler';
                SELECT pg_database_size(current_database()) INTO database_bytes;
                SELECT (metadata_json->>'database_bytes')::bigint INTO previous_bytes
                    FROM public.operational_events
                    WHERE event_type = 'scheduler.heartbeat'
                      AND occurred_at <= clock_timestamp() - interval '24 hours'
                      AND metadata_json ? 'database_bytes'
                    ORDER BY occurred_at DESC LIMIT 1;

                FOR tenant IN SELECT id FROM public.churches LOOP
                    PERFORM set_config('app.current_church_id', tenant.id::text, true);
                    SELECT max(dispatched_at) INTO tenant_birthday_at FROM public.birthday_notification_dispatches;
                    birthday_at := GREATEST(birthday_at, tenant_birthday_at);
                    IF tenant_birthday_at IS NULL OR tenant_birthday_at < clock_timestamp() - interval '26 hours' THEN
                        birthday_stale := birthday_stale + 1;
                    END IF;
                    SELECT birthday_failed + count(*) INTO birthday_failed FROM public.birthday_notification_deliveries
                        WHERE status = 'failed' AND updated_at >= clock_timestamp() - interval '24 hours';
                    SELECT sync_count + count(*), sync_rejected + count(*) FILTER (WHERE result_status = 'rejected')
                        INTO sync_count, sync_rejected FROM public.sync_events WHERE received_at >= clock_timestamp() - interval '24 hours';
                    SELECT conflict_count + count(*) INTO conflict_count FROM public.sync_conflicts WHERE status = 'open';
                END LOOP;
                PERFORM set_config('app.current_church_id', COALESCE(previous_scope, ''), true);

                queue_status := CASE WHEN failed_count > 0 OR oldest_age > queue_warning_seconds THEN 'degraded' ELSE 'ok' END;
                scheduler_status := CASE WHEN scheduler_at IS NULL OR scheduler_at < clock_timestamp() - make_interval(secs => scheduler_warning_seconds) THEN 'degraded' ELSE 'ok' END;
                birthday_status := CASE WHEN birthday_failed > 0 OR birthday_stale > 0 OR birthday_at IS NULL THEN 'degraded' ELSE 'ok' END;
                sync_status := CASE WHEN sync_rejected > 0 OR conflict_count > 0 THEN 'degraded' ELSE 'ok' END;
                overall_status := CASE WHEN queue_status = 'ok' AND scheduler_status = 'ok' AND birthday_status = 'ok' AND sync_status = 'ok' THEN 'healthy' ELSE 'degraded' END;

                RETURN jsonb_build_object(
                    'status', overall_status,
                    'checked_at', to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                    'api', jsonb_build_object('status', 'ok'),
                    'database', jsonb_build_object('status', 'ok', 'size_bytes', database_bytes, 'growth_bytes_24h', CASE WHEN previous_bytes IS NULL THEN NULL ELSE database_bytes - previous_bytes END),
                    'queue', jsonb_build_object('status', queue_status, 'pending_count', pending_count, 'oldest_age_seconds', oldest_age, 'failed_24h', failed_count),
                    'scheduler', jsonb_build_object('status', scheduler_status, 'last_run_at', scheduler_at),
                    'birthdays', jsonb_build_object('status', birthday_status, 'last_dispatch_at', birthday_at, 'failed_24h', birthday_failed),
                    'synchronization', jsonb_build_object('status', sync_status, 'events_24h', sync_count, 'rejected_24h', sync_rejected, 'open_conflicts', conflict_count,
                        'error_rate', CASE WHEN sync_count = 0 THEN 0 ELSE round(sync_rejected::numeric / sync_count, 4) END)
                );
            EXCEPTION WHEN OTHERS THEN
                PERFORM set_config('app.current_church_id', COALESCE(previous_scope, ''), true);
                RAISE;
            END
            \$\$;

            CREATE OR REPLACE FUNCTION prune_operational_data(
                operational_cutoff timestamptz,
                security_cutoff timestamptz,
                sync_cutoff timestamptz,
                feed_cutoff timestamptz
            ) RETURNS jsonb
            LANGUAGE plpgsql
            SECURITY DEFINER
            SET search_path = pg_catalog
            AS \$\$
            DECLARE
                tenant record;
                previous_scope text := current_setting('app.current_church_id', true);
                active_floor bigint;
                affected bigint;
                operational_count bigint := 0;
                security_count bigint := 0;
                sync_count bigint := 0;
                feed_count bigint := 0;
                batch_size constant integer := 1000;
            BEGIN
                IF operational_cutoff > clock_timestamp() - interval '30 days'
                    OR security_cutoff > clock_timestamp() - interval '180 days'
                    OR sync_cutoff > clock_timestamp() - interval '180 days'
                    OR feed_cutoff > clock_timestamp() - interval '90 days' THEN
                    RAISE EXCEPTION 'Retention cutoff is newer than policy';
                END IF;

                LOOP
                    DELETE FROM public.operational_events
                    WHERE id IN (
                        SELECT id FROM public.operational_events
                        WHERE occurred_at <= operational_cutoff
                        ORDER BY occurred_at LIMIT batch_size
                    );
                    GET DIAGNOSTICS affected = ROW_COUNT;
                    operational_count := operational_count + affected;
                    EXIT WHEN affected = 0;
                END LOOP;
                LOOP
                    DELETE FROM public.security_events
                    WHERE id IN (
                        SELECT id FROM public.security_events
                        WHERE church_id IS NULL AND occurred_at <= security_cutoff
                        ORDER BY occurred_at LIMIT batch_size
                    );
                    GET DIAGNOSTICS affected = ROW_COUNT;
                    security_count := security_count + affected;
                    EXIT WHEN affected = 0;
                END LOOP;

                FOR tenant IN SELECT id FROM public.churches LOOP
                    PERFORM set_config('app.current_church_id', tenant.id::text, true);
                    LOOP
                        DELETE FROM public.security_events
                        WHERE id IN (
                            SELECT id FROM public.security_events
                            WHERE church_id = tenant.id AND occurred_at <= security_cutoff
                            ORDER BY occurred_at LIMIT batch_size
                        );
                        GET DIAGNOSTICS affected = ROW_COUNT;
                        security_count := security_count + affected;
                        EXIT WHEN affected = 0;
                    END LOOP;
                    LOOP
                        DELETE FROM public.sync_events
                        WHERE id IN (
                            SELECT id FROM public.sync_events
                            WHERE church_id = tenant.id AND received_at <= sync_cutoff
                            ORDER BY received_at LIMIT batch_size
                        );
                        GET DIAGNOSTICS affected = ROW_COUNT;
                        sync_count := sync_count + affected;
                        EXIT WHEN affected = 0;
                    END LOOP;

                    SELECT min(COALESCE(cursor.cursor, 0)) INTO active_floor
                    FROM public.offline_authorizations authz
                    LEFT JOIN public.device_cursors cursor
                      ON cursor.membership_id = authz.membership_id AND cursor.device_id = authz.device_id
                    WHERE authz.church_id = tenant.id
                      AND authz.revoked_at IS NULL
                      AND authz.expires_at > clock_timestamp();
                    LOOP
                        DELETE FROM public.change_feed
                        WHERE sequence IN (
                            SELECT sequence FROM public.change_feed
                            WHERE church_id = tenant.id AND created_at <= feed_cutoff
                              AND (active_floor IS NULL OR sequence <= active_floor)
                            ORDER BY sequence LIMIT batch_size
                        );
                        GET DIAGNOSTICS affected = ROW_COUNT;
                        feed_count := feed_count + affected;
                        EXIT WHEN affected = 0;
                    END LOOP;
                END LOOP;
                PERFORM set_config('app.current_church_id', COALESCE(previous_scope, ''), true);

                RETURN jsonb_build_object('operational_events', operational_count, 'security_events', security_count, 'sync_events', sync_count, 'change_feed', feed_count);
            EXCEPTION WHEN OTHERS THEN
                PERFORM set_config('app.current_church_id', COALESCE(previous_scope, ''), true);
                RAISE;
            END
            \$\$;

            CREATE OR REPLACE FUNCTION purge_revoked_device_data(secret_cutoff timestamptz, authorization_cutoff timestamptz)
            RETURNS jsonb
            LANGUAGE plpgsql
            SECURITY DEFINER
            SET search_path = pg_catalog
            AS \$\$
            DECLARE
                tenant record;
                previous_scope text := current_setting('app.current_church_id', true);
                affected bigint;
                marked_count bigint := 0;
                secret_count bigint := 0;
                authorization_count bigint := 0;
                batch_size constant integer := 1000;
            BEGIN
                IF secret_cutoff > clock_timestamp() - interval '30 days'
                    OR authorization_cutoff > clock_timestamp() - interval '180 days' THEN
                    RAISE EXCEPTION 'Device cutoff is newer than policy';
                END IF;
                FOR tenant IN SELECT id FROM public.churches LOOP
                    PERFORM set_config('app.current_church_id', tenant.id::text, true);
                    UPDATE public.device_cursors cursor SET full_resync_required = true
                    WHERE cursor.church_id = tenant.id AND cursor.full_resync_required = false
                      AND EXISTS (
                          SELECT 1 FROM public.offline_authorizations authz
                          WHERE authz.church_id = cursor.church_id
                            AND authz.membership_id = cursor.membership_id
                            AND authz.device_id = cursor.device_id
                            AND (authz.revoked_at IS NOT NULL OR authz.expires_at <= clock_timestamp())
                      );
                    GET DIAGNOSTICS affected = ROW_COUNT;
                    marked_count := marked_count + affected;

                    UPDATE public.push_subscriptions SET endpoint_hash = NULL, endpoint_ciphertext = NULL,
                        p256dh_ciphertext = NULL, auth_ciphertext = NULL, updated_at = clock_timestamp()
                    WHERE church_id = tenant.id AND endpoint_ciphertext IS NOT NULL
                      AND COALESCE(revoked_at, expires_at) <= secret_cutoff;
                    GET DIAGNOSTICS affected = ROW_COUNT;
                    secret_count := secret_count + affected;

                    LOOP
                        DELETE FROM public.offline_authorizations
                        WHERE id IN (
                            SELECT id FROM public.offline_authorizations
                            WHERE church_id = tenant.id AND COALESCE(revoked_at, expires_at) <= authorization_cutoff
                            ORDER BY COALESCE(revoked_at, expires_at) LIMIT batch_size
                        );
                        GET DIAGNOSTICS affected = ROW_COUNT;
                        authorization_count := authorization_count + affected;
                        EXIT WHEN affected = 0;
                    END LOOP;
                END LOOP;
                PERFORM set_config('app.current_church_id', COALESCE(previous_scope, ''), true);
                RETURN jsonb_build_object('devices_marked', marked_count, 'subscription_secrets_purged', secret_count, 'authorizations_purged', authorization_count);
            EXCEPTION WHEN OTHERS THEN
                PERFORM set_config('app.current_church_id', COALESCE(previous_scope, ''), true);
                RAISE;
            END
            \$\$;

            REVOKE ALL ON FUNCTION record_system_heartbeat(text,text,timestamptz,uuid,uuid) FROM PUBLIC;
            REVOKE ALL ON FUNCTION system_health_metrics(integer,integer) FROM PUBLIC;
            REVOKE ALL ON FUNCTION prune_operational_data(timestamptz,timestamptz,timestamptz,timestamptz) FROM PUBLIC;
            REVOKE ALL ON FUNCTION purge_revoked_device_data(timestamptz,timestamptz) FROM PUBLIC;
            GRANT SELECT ON system_heartbeats TO "{$role}";
            GRANT EXECUTE ON FUNCTION record_system_heartbeat(text,text,timestamptz,uuid,uuid) TO "{$role}";
            GRANT EXECUTE ON FUNCTION system_health_metrics(integer,integer) TO "{$role}";
            GRANT EXECUTE ON FUNCTION prune_operational_data(timestamptz,timestamptz,timestamptz,timestamptz) TO "{$role}";
            GRANT EXECUTE ON FUNCTION purge_revoked_device_data(timestamptz,timestamptz) TO "{$role}";
            SQL);
    }

    public function down(): void
    {
        $db = DB::connection($this->getConnection());
        $db->unprepared('DROP FUNCTION IF EXISTS purge_revoked_device_data(timestamptz,timestamptz);
            DROP FUNCTION IF EXISTS prune_operational_data(timestamptz,timestamptz,timestamptz,timestamptz);
            DROP FUNCTION IF EXISTS system_health_metrics(integer,integer);
            DROP FUNCTION IF EXISTS record_system_heartbeat(text,text,timestamptz,uuid,uuid);');
        Schema::connection($this->getConnection())->table('device_cursors', function (Blueprint $table): void {
            $table->dropColumn('full_resync_required');
        });
        Schema::connection($this->getConnection())->dropIfExists('system_heartbeats');
        Schema::connection($this->getConnection())->dropIfExists('operational_events');
    }
};
