<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $db = DB::connection($this->getConnection());
        $role = config('database.runtime_role');
        if (! is_string($role) || ! preg_match('/\A[a-z_][a-z0-9_]*\z/', $role)) {
            throw new RuntimeException('Invalid runtime role.');
        }
        $db->unprepared(<<<'SQL'
            ALTER TABLE device_cursors
                ADD applied_cursor bigint CHECK (applied_cursor >= 0),
                ADD applied_generation uuid,
                ADD applied_coverage_epoch uuid,
                ADD applied_scope_digest char(64) CHECK (applied_scope_digest ~ '^[a-f0-9]{64}$'),
                ADD applied_evidence_at timestamptz(6),
                ADD receipt_coverage varchar(8) NOT NULL DEFAULT 'unknown' CHECK (receipt_coverage IN ('unknown','complete','pruned')),
                ADD receipt_coverage_since timestamptz(6),
                ADD receipt_pruned_through timestamptz(6),
                ADD active_recovery_id uuid,
                ADD CONSTRAINT recovery_device_binding UNIQUE (church_id,membership_id,device_id),
                ADD CONSTRAINT recovery_applied_group CHECK (
                    num_nonnulls(applied_cursor,applied_generation,applied_coverage_epoch,applied_scope_digest,applied_evidence_at) IN (0,5)),
                ADD CONSTRAINT recovery_receipt_coverage CHECK (
                    (receipt_coverage = 'unknown' AND receipt_coverage_since IS NULL AND receipt_pruned_through IS NULL)
                    OR (receipt_coverage = 'complete' AND receipt_coverage_since IS NOT NULL AND receipt_pruned_through IS NULL)
                    OR (receipt_coverage = 'pruned' AND receipt_pruned_through IS NOT NULL));

            CREATE TABLE sync_recovery_progress (
                church_id uuid PRIMARY KEY REFERENCES churches(id),
                feed_head bigint NOT NULL CHECK (feed_head >= 0),
                baseline_sequence_floor bigint NOT NULL CHECK (baseline_sequence_floor >= 0),
                pruned_through bigint CHECK (pruned_through >= 0),
                coverage_epoch uuid NOT NULL,
                history_baselined_at timestamptz(6),
                updated_at timestamptz(6) NOT NULL,
                CHECK (pruned_through IS NULL OR pruned_through <= GREATEST(feed_head,baseline_sequence_floor))
            );
            -- No rows or applied evidence are seeded. Writer-drain initialization is separate scope.
            CREATE TABLE offline_recovery_runs (
                id uuid PRIMARY KEY,
                church_id uuid NOT NULL,
                membership_id uuid NOT NULL,
                device_id uuid NOT NULL,
                actor_id bigint NOT NULL REFERENCES users(id),
                request_id uuid NOT NULL,
                local_generation_id uuid NOT NULL,
                generation uuid NOT NULL UNIQUE,
                coverage_epoch uuid NOT NULL,
                state varchar(16) NOT NULL DEFAULT 'collecting' CHECK (state IN ('collecting','ready','client_confirmed','expired','superseded')),
                input_manifest_digest char(64) CHECK (input_manifest_digest ~ '^[a-f0-9]{64}$'),
                snapshot_manifest_digest char(64) CHECK (snapshot_manifest_digest ~ '^[a-f0-9]{64}$'),
                scope_digest char(64) CHECK (scope_digest ~ '^[a-f0-9]{64}$'),
                snapshot_cursor bigint CHECK (snapshot_cursor >= 0),
                window_start date,
                window_end date,
                timezone varchar(64),
                input_page_count integer NOT NULL DEFAULT 0 CHECK (input_page_count >= 0),
                output_page_count integer NOT NULL DEFAULT 0 CHECK (output_page_count >= 0),
                input_item_count bigint NOT NULL DEFAULT 0 CHECK (input_item_count >= 0),
                output_item_count bigint NOT NULL DEFAULT 0 CHECK (output_item_count >= 0),
                stored_bytes bigint NOT NULL DEFAULT 0 CHECK (stored_bytes >= 0),
                max_input_pages integer NOT NULL CHECK (max_input_pages > 0),
                max_output_pages integer NOT NULL CHECK (max_output_pages > 0),
                max_items bigint NOT NULL CHECK (max_items > 0),
                max_stored_bytes bigint NOT NULL CHECK (max_stored_bytes > 0),
                created_at timestamptz(6) NOT NULL,
                expires_at timestamptz(6) NOT NULL,
                sealed_at timestamptz(6),
                client_confirmed_at timestamptz(6),
                pages_purged_at timestamptz(6),
                UNIQUE (church_id,id),
                UNIQUE (church_id,membership_id,device_id,id),
                UNIQUE (church_id,membership_id,device_id,generation,coverage_epoch,scope_digest),
                UNIQUE (church_id,membership_id,device_id,request_id),
                FOREIGN KEY (church_id,membership_id,device_id) REFERENCES device_cursors(church_id,membership_id,device_id),
                CHECK (expires_at > created_at),
                CHECK (input_page_count <= max_input_pages AND output_page_count <= max_output_pages
                    AND input_item_count + output_item_count <= max_items AND stored_bytes <= max_stored_bytes),
                CHECK ((sealed_at IS NULL AND num_nonnulls(input_manifest_digest,snapshot_manifest_digest,scope_digest,snapshot_cursor,window_start,window_end,timezone) = 0)
                    OR (sealed_at IS NOT NULL AND num_nonnulls(input_manifest_digest,snapshot_manifest_digest,scope_digest,snapshot_cursor,window_start,window_end,timezone) = 7
                        AND window_start = window_end - 89 AND sealed_at >= created_at AND sealed_at < expires_at)),
                CHECK (state NOT IN ('ready','client_confirmed') OR sealed_at IS NOT NULL),
                CHECK (state <> 'collecting' OR sealed_at IS NULL),
                CHECK ((state = 'client_confirmed' AND client_confirmed_at IS NOT NULL AND client_confirmed_at >= sealed_at)
                    OR (state <> 'client_confirmed' AND (client_confirmed_at IS NULL OR sealed_at IS NOT NULL)))
            );
            CREATE INDEX recovery_runs_device ON offline_recovery_runs(church_id,membership_id,device_id,created_at);
            CREATE INDEX recovery_runs_expiry ON offline_recovery_runs(expires_at,state);
            ALTER TABLE device_cursors
                ADD FOREIGN KEY (church_id,membership_id,device_id,active_recovery_id)
                    REFERENCES offline_recovery_runs(church_id,membership_id,device_id,id),
                ADD FOREIGN KEY (church_id,membership_id,device_id,applied_generation,applied_coverage_epoch,applied_scope_digest)
                    REFERENCES offline_recovery_runs(church_id,membership_id,device_id,generation,coverage_epoch,scope_digest);
            CREATE TABLE offline_recovery_pages (
                church_id uuid NOT NULL,
                run_id uuid NOT NULL,
                kind varchar(6) NOT NULL CHECK (kind IN ('input','output')),
                ordinal integer NOT NULL CHECK (ordinal >= 0),
                item_count integer NOT NULL CHECK (item_count BETWEEN 0 AND 100),
                plaintext_bytes integer NOT NULL CHECK (plaintext_bytes BETWEEN 0 AND 1048576),
                content_digest char(64) NOT NULL CHECK (content_digest ~ '^[a-f0-9]{64}$'),
                payload_ciphertext text NOT NULL CHECK (octet_length(payload_ciphertext) BETWEEN 1 AND 2097152),
                created_at timestamptz(6) NOT NULL,
                PRIMARY KEY (church_id,run_id,kind,ordinal),
                FOREIGN KEY (church_id,run_id) REFERENCES offline_recovery_runs(church_id,id)
            );

            CREATE OR REPLACE FUNCTION recovery_guard_progress() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
            BEGIN
                IF NEW.church_id <> OLD.church_id OR NEW.coverage_epoch <> OLD.coverage_epoch
                    OR NEW.baseline_sequence_floor <> OLD.baseline_sequence_floor
                    OR NEW.feed_head < OLD.feed_head
                    OR (OLD.pruned_through IS NOT NULL AND (NEW.pruned_through IS NULL OR NEW.pruned_through < OLD.pruned_through))
                    OR (OLD.history_baselined_at IS NOT NULL AND NEW.history_baselined_at IS DISTINCT FROM OLD.history_baselined_at) THEN
                    RAISE EXCEPTION 'Recovery progress cannot discard evidence' USING ERRCODE='23514';
                END IF;
                RETURN NEW;
            END $$;
            CREATE TRIGGER recovery_progress_guard BEFORE UPDATE ON sync_recovery_progress FOR EACH ROW EXECUTE FUNCTION recovery_guard_progress();

            CREATE OR REPLACE FUNCTION recovery_guard_device() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
            BEGIN
                IF TG_OP='INSERT' THEN
                    IF NEW.receipt_coverage<>'unknown' THEN
                        RAISE EXCEPTION 'Fresh receipt coverage admission is unavailable' USING ERRCODE='23514';
                    END IF;
                    RETURN NEW;
                END IF;
                IF (NEW.church_id,NEW.membership_id,NEW.device_id) IS DISTINCT FROM (OLD.church_id,OLD.membership_id,OLD.device_id)
                    OR (OLD.receipt_coverage IN ('unknown','pruned') AND NEW.receipt_coverage='complete')
                    OR (OLD.receipt_coverage_since IS NOT NULL AND NEW.receipt_coverage_since<OLD.receipt_coverage_since)
                    OR (OLD.receipt_coverage='pruned' AND NEW.receipt_coverage<>'pruned')
                    OR (OLD.receipt_pruned_through IS NOT NULL AND (NEW.receipt_pruned_through IS NULL OR NEW.receipt_pruned_through<OLD.receipt_pruned_through))
                    OR (OLD.applied_cursor IS NOT NULL AND NEW.applied_cursor IS NULL)
                    OR (NEW.applied_coverage_epoch=OLD.applied_coverage_epoch AND NEW.applied_cursor<OLD.applied_cursor) THEN
                    RAISE EXCEPTION 'Device evidence cannot be guessed or discarded' USING ERRCODE='23514';
                END IF;
                IF ROW(NEW.applied_cursor,NEW.applied_generation,NEW.applied_coverage_epoch,NEW.applied_scope_digest,NEW.applied_evidence_at)
                    IS DISTINCT FROM ROW(OLD.applied_cursor,OLD.applied_generation,OLD.applied_coverage_epoch,OLD.applied_scope_digest,OLD.applied_evidence_at)
                    AND NEW.applied_cursor IS NOT NULL AND NOT EXISTS (
                    SELECT 1 FROM public.offline_recovery_runs r JOIN public.sync_recovery_progress p ON p.church_id=r.church_id
                    WHERE r.church_id=NEW.church_id AND r.membership_id=NEW.membership_id AND r.device_id=NEW.device_id
                        AND r.generation=NEW.applied_generation AND r.coverage_epoch=NEW.applied_coverage_epoch AND p.coverage_epoch=r.coverage_epoch
                        AND r.scope_digest=NEW.applied_scope_digest AND r.sealed_at IS NOT NULL
                        AND NEW.active_recovery_id=r.id
                        AND r.state IN ('ready','client_confirmed') AND r.expires_at>clock_timestamp()
                        AND NEW.applied_cursor>=r.snapshot_cursor AND NEW.applied_cursor<=GREATEST(p.feed_head,p.baseline_sequence_floor)) THEN
                    RAISE EXCEPTION 'Applied evidence binding unavailable' USING ERRCODE='23514';
                END IF;
                RETURN NEW;
            END $$;
            CREATE TRIGGER recovery_device_guard BEFORE INSERT OR UPDATE ON device_cursors FOR EACH ROW EXECUTE FUNCTION recovery_guard_device();

            CREATE OR REPLACE FUNCTION recovery_guard_run() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
            BEGIN
                IF TG_OP = 'INSERT' THEN
                    IF NEW.state <> 'collecting' OR NEW.sealed_at IS NOT NULL OR NEW.client_confirmed_at IS NOT NULL OR NEW.pages_purged_at IS NOT NULL
                        OR NEW.input_page_count <> 0 OR NEW.output_page_count <> 0 OR NEW.input_item_count <> 0 OR NEW.output_item_count <> 0 OR NEW.stored_bytes <> 0 THEN
                        RAISE EXCEPTION 'Recovery runs start empty and unconfirmed' USING ERRCODE='23514';
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM public.church_memberships m WHERE m.church_id=NEW.church_id AND m.id=NEW.membership_id AND m.user_id=NEW.actor_id AND m.status='active')
                        OR NOT EXISTS (SELECT 1 FROM public.sync_recovery_progress p WHERE p.church_id=NEW.church_id AND p.coverage_epoch=NEW.coverage_epoch AND p.history_baselined_at IS NOT NULL) THEN
                        RAISE EXCEPTION 'Recovery run binding unavailable' USING ERRCODE='23514';
                    END IF;
                ELSE
                    IF (to_jsonb(NEW) - ARRAY['state','sealed_at','client_confirmed_at','pages_purged_at','input_manifest_digest','snapshot_manifest_digest','scope_digest','snapshot_cursor','window_start','window_end','timezone','input_page_count','output_page_count','input_item_count','output_item_count','stored_bytes'])
                        IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['state','sealed_at','client_confirmed_at','pages_purged_at','input_manifest_digest','snapshot_manifest_digest','scope_digest','snapshot_cursor','window_start','window_end','timezone','input_page_count','output_page_count','input_item_count','output_item_count','stored_bytes']) THEN
                        RAISE EXCEPTION 'Recovery identity and limits are immutable' USING ERRCODE='23514';
                    END IF;
                    IF OLD.sealed_at IS NOT NULL AND (to_jsonb(NEW) - ARRAY['state','client_confirmed_at','pages_purged_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['state','client_confirmed_at','pages_purged_at']) THEN
                        RAISE EXCEPTION 'Sealed recovery is immutable' USING ERRCODE='23514';
                    END IF;
                    IF NEW.state <> OLD.state AND NOT ((OLD.state='collecting' AND NEW.state IN ('ready','expired','superseded'))
                        OR (OLD.state='ready' AND NEW.state IN ('client_confirmed','expired','superseded'))
                        OR (OLD.state='client_confirmed' AND NEW.state IN ('expired','superseded'))) THEN
                        RAISE EXCEPTION 'Invalid recovery lifecycle' USING ERRCODE='23514';
                    END IF;
                    IF OLD.client_confirmed_at IS NOT NULL AND NEW.client_confirmed_at IS DISTINCT FROM OLD.client_confirmed_at THEN
                        RAISE EXCEPTION 'Confirmation evidence is immutable' USING ERRCODE='23514';
                    END IF;
                END IF;
                RETURN NEW;
            END $$;
            CREATE TRIGGER recovery_run_guard BEFORE INSERT OR UPDATE ON offline_recovery_runs FOR EACH ROW EXECUTE FUNCTION recovery_guard_run();

            CREATE OR REPLACE FUNCTION recovery_store_page() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
            DECLARE r public.offline_recovery_runs; current_scope uuid := NULLIF(current_setting('app.current_church_id',true),'')::uuid;
            BEGIN
                IF NEW.church_id IS DISTINCT FROM current_scope THEN RAISE EXCEPTION 'Recovery tenant mismatch' USING ERRCODE='42501'; END IF;
                SELECT * INTO r FROM public.offline_recovery_runs WHERE church_id=current_scope AND id=NEW.run_id FOR UPDATE;
                IF NOT FOUND OR r.state <> 'collecting' OR r.expires_at <= clock_timestamp() THEN
                    RAISE EXCEPTION 'Recovery run not collecting' USING ERRCODE='23514';
                END IF;
                IF NEW.ordinal <> (CASE WHEN NEW.kind='input' THEN r.input_page_count ELSE r.output_page_count END) THEN
                    RAISE EXCEPTION 'Recovery page ordinal gap' USING ERRCODE='23514';
                END IF;
                UPDATE public.offline_recovery_runs SET
                    input_page_count=input_page_count+CASE WHEN NEW.kind='input' THEN 1 ELSE 0 END,
                    output_page_count=output_page_count+CASE WHEN NEW.kind='output' THEN 1 ELSE 0 END,
                    input_item_count=input_item_count+CASE WHEN NEW.kind='input' THEN NEW.item_count ELSE 0 END,
                    output_item_count=output_item_count+CASE WHEN NEW.kind='output' THEN NEW.item_count ELSE 0 END,
                    stored_bytes=stored_bytes+octet_length(NEW.payload_ciphertext)
                    WHERE church_id=current_scope AND id=NEW.run_id;
                RETURN NEW;
            END $$;
            CREATE TRIGGER recovery_page_insert AFTER INSERT ON offline_recovery_pages FOR EACH ROW EXECUTE FUNCTION recovery_store_page();
            CREATE OR REPLACE FUNCTION recovery_reject_page_update() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN RAISE EXCEPTION 'Recovery pages are immutable' USING ERRCODE='23514'; END $$;
            CREATE TRIGGER recovery_page_immutable BEFORE UPDATE ON offline_recovery_pages FOR EACH ROW EXECUTE FUNCTION recovery_reject_page_update();

            -- Storage lifecycle primitive only. No snapshot builder, page hash validation or API exists here.
            CREATE OR REPLACE FUNCTION transition_recovery_run(target uuid, expected varchar, patch jsonb) RETURNS void
            LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
            DECLARE r public.offline_recovery_runs; n public.offline_recovery_runs; scope uuid := NULLIF(current_setting('app.current_church_id',true),'')::uuid;
            BEGIN
                IF jsonb_typeof(patch) IS DISTINCT FROM 'object' OR (patch - ARRAY['state','input_manifest_digest','snapshot_manifest_digest','scope_digest','snapshot_cursor','window_start','window_end','timezone']) <> '{}'::jsonb THEN
                    RAISE EXCEPTION 'Invalid recovery transition fields' USING ERRCODE='23514';
                END IF;
                SELECT * INTO r FROM public.offline_recovery_runs WHERE church_id=scope AND id=target FOR UPDATE;
                IF NOT FOUND OR r.state <> expected THEN RAISE EXCEPTION 'Stale recovery transition' USING ERRCODE='23514'; END IF;
                n := jsonb_populate_record(r,patch);
                IF n.state=r.state THEN RAISE EXCEPTION 'A lifecycle transition is required' USING ERRCODE='23514'; END IF;
                IF n.state IN ('ready','client_confirmed') AND r.expires_at <= clock_timestamp() THEN
                    RAISE EXCEPTION 'Recovery expired' USING ERRCODE='23514';
                END IF;
                IF n.state='ready' THEN
                    IF r.input_page_count=0 OR r.output_page_count=0 OR NOT EXISTS (SELECT 1 FROM public.sync_recovery_progress p
                        WHERE p.church_id=scope AND p.coverage_epoch=r.coverage_epoch AND n.snapshot_cursor=GREATEST(p.feed_head,p.baseline_sequence_floor)) THEN
                        RAISE EXCEPTION 'Recovery storage or cut incomplete' USING ERRCODE='23514';
                    END IF;
                    n.sealed_at := clock_timestamp();
                END IF;
                IF n.state='client_confirmed' THEN n.client_confirmed_at := clock_timestamp(); END IF;
                IF n.state='expired' AND r.expires_at > clock_timestamp() THEN RAISE EXCEPTION 'Recovery is not expired' USING ERRCODE='23514'; END IF;
                UPDATE public.offline_recovery_runs SET state=n.state, input_manifest_digest=n.input_manifest_digest,
                    snapshot_manifest_digest=n.snapshot_manifest_digest,scope_digest=n.scope_digest,snapshot_cursor=n.snapshot_cursor,
                    window_start=n.window_start,window_end=n.window_end,timezone=n.timezone,sealed_at=n.sealed_at,
                    client_confirmed_at=n.client_confirmed_at WHERE church_id=scope AND id=target;
            END $$;
            CREATE OR REPLACE FUNCTION cleanup_recovery_pages(target uuid) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
            DECLARE r public.offline_recovery_runs; affected bigint; scope uuid := NULLIF(current_setting('app.current_church_id',true),'')::uuid;
            BEGIN
                SELECT * INTO r FROM public.offline_recovery_runs WHERE church_id=scope AND id=target FOR UPDATE;
                IF NOT FOUND OR r.state NOT IN ('expired','superseded') OR EXISTS (SELECT 1 FROM public.device_cursors d WHERE d.church_id=scope AND d.active_recovery_id=target) THEN
                    RAISE EXCEPTION 'Recovery cleanup unavailable' USING ERRCODE='23514';
                END IF;
                DELETE FROM public.offline_recovery_pages WHERE church_id=scope AND run_id=target;
                GET DIAGNOSTICS affected=ROW_COUNT;
                UPDATE public.offline_recovery_runs SET pages_purged_at=COALESCE(pages_purged_at,clock_timestamp()) WHERE church_id=scope AND id=target;
                RETURN affected;
            END $$;
            SQL);
        foreach (['sync_recovery_progress', 'offline_recovery_runs', 'offline_recovery_pages'] as $table) {
            $db->unprepared("ALTER TABLE {$table} ENABLE ROW LEVEL SECURITY; ALTER TABLE {$table} FORCE ROW LEVEL SECURITY;
                CREATE POLICY {$table}_tenant ON {$table} USING (church_id=NULLIF(current_setting('app.current_church_id',true),'')::uuid)
                WITH CHECK (church_id=NULLIF(current_setting('app.current_church_id',true),'')::uuid); REVOKE ALL ON {$table} FROM PUBLIC;");
        }
        $db->unprepared("GRANT SELECT ON sync_recovery_progress,offline_recovery_runs,offline_recovery_pages TO \"{$role}\";
            GRANT UPDATE(feed_head,pruned_through,updated_at) ON sync_recovery_progress TO \"{$role}\";
            GRANT INSERT ON offline_recovery_runs,offline_recovery_pages TO \"{$role}\";
            REVOKE ALL ON FUNCTION transition_recovery_run(uuid,varchar,jsonb),cleanup_recovery_pages(uuid) FROM PUBLIC;
            REVOKE ALL ON FUNCTION recovery_guard_progress(),recovery_guard_device(),recovery_guard_run(),recovery_store_page(),recovery_reject_page_update() FROM PUBLIC;
            GRANT EXECUTE ON FUNCTION transition_recovery_run(uuid,varchar,jsonb),cleanup_recovery_pages(uuid) TO \"{$role}\";");
    }

    public function down(): void
    {
        throw new RuntimeException('Recovery evidence is preserved. Rollback requires a separately approved recovery plan.');
    }
};
