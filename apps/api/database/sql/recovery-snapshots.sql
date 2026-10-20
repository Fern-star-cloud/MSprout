CREATE OR REPLACE FUNCTION recovery_guard_run() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
            BEGIN
                IF NEW.schema_version IS NOT NULL THEN
                    IF NEW.schema_version <> 'attendance-recovery-v1' OR NEW.request_digest IS NULL OR NEW.authority_digest IS NULL
                        OR NEW.expires_at > NEW.created_at + interval '4 hours' OR NEW.state='client_confirmed' OR NEW.client_confirmed_at IS NOT NULL THEN
                        RAISE EXCEPTION 'Snapshot binding or completion unavailable' USING ERRCODE='23514';
                    END IF;
                    IF NEW.state='ready' THEN
                        IF NEW.scope_digest IS DISTINCT FROM NEW.authority_digest OR NEW.expires_at <= clock_timestamp()
                            OR NEW.input_manifest_digest IS DISTINCT FROM (SELECT encode(sha256(convert_to(COALESCE(string_agg(content_digest,'' ORDER BY ordinal),''),'UTF8')),'hex') FROM public.offline_recovery_pages WHERE church_id=NEW.church_id AND run_id=NEW.id AND kind='input')
                            OR NEW.snapshot_manifest_digest IS DISTINCT FROM (SELECT encode(sha256(convert_to(COALESCE(string_agg(content_digest,'' ORDER BY ordinal),''),'UTF8')),'hex') FROM public.offline_recovery_pages WHERE church_id=NEW.church_id AND run_id=NEW.id AND kind='output') THEN
                            RAISE EXCEPTION 'Snapshot manifest incomplete' USING ERRCODE='23514';
                        END IF;
                    END IF;
                END IF;
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
CREATE OR REPLACE FUNCTION snapshot_reject_applied_credit() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
    IF ROW(NEW.applied_cursor,NEW.applied_generation,NEW.applied_coverage_epoch,NEW.applied_scope_digest,NEW.applied_evidence_at)
        IS DISTINCT FROM ROW(OLD.applied_cursor,OLD.applied_generation,OLD.applied_coverage_epoch,OLD.applied_scope_digest,OLD.applied_evidence_at)
        AND EXISTS (SELECT 1 FROM public.offline_recovery_runs r WHERE r.church_id=NEW.church_id AND r.generation=NEW.applied_generation AND r.schema_version IS NOT NULL) THEN
        RAISE EXCEPTION 'Client reconstruction is not qualified' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER snapshot_applied_credit_guard BEFORE UPDATE ON device_cursors FOR EACH ROW EXECUTE FUNCTION snapshot_reject_applied_credit();
REVOKE ALL ON FUNCTION snapshot_reject_applied_credit() FROM PUBLIC;

-- Reuse the inherited signature, but make cleanup a separately authenticated,
-- SQL-audited maintenance operation. A tenant/worker GUC never grants authority.
CREATE OR REPLACE FUNCTION public.cleanup_recovery_pages(target uuid) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r public.offline_recovery_runs; affected bigint;
    scope uuid := NULLIF(current_setting('app.current_church_id',true),'')::uuid;
    correlation text := current_setting('app.correlation_id',true);
BEGIN
    IF session_user <> '__MAINTENANCE_ROLE__' OR scope IS NULL THEN
        RAISE EXCEPTION 'Recovery maintenance identity unavailable' USING ERRCODE='42501';
    END IF;
    PERFORM 1 FROM public.churches WHERE id=scope AND status IN ('active','suspended') FOR NO KEY UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Recovery cleanup unavailable' USING ERRCODE='23514'; END IF;
    SELECT * INTO r FROM public.offline_recovery_runs WHERE church_id=scope AND id=target FOR UPDATE;
    IF NOT FOUND OR r.pages_purged_at IS NOT NULL THEN
        RAISE EXCEPTION 'Recovery cleanup unavailable' USING ERRCODE='23514';
    END IF;
    IF r.schema_version IS NOT NULL THEN
        IF r.expires_at>clock_timestamp() OR r.state NOT IN ('collecting','ready','expired','superseded') THEN
            RAISE EXCEPTION 'Recovery cleanup unavailable' USING ERRCODE='23514';
        END IF;
        IF r.state IN ('collecting','ready') THEN
            UPDATE public.offline_recovery_runs SET state='expired' WHERE church_id=scope AND id=target;
        END IF;
        UPDATE public.device_cursors SET active_recovery_id=NULL
            WHERE church_id=scope AND membership_id=r.membership_id AND device_id=r.device_id AND active_recovery_id=target;
    ELSIF r.state NOT IN ('expired','superseded') THEN
        RAISE EXCEPTION 'Recovery cleanup unavailable' USING ERRCODE='23514';
    END IF;
    IF EXISTS(SELECT 1 FROM public.device_cursors WHERE church_id=scope AND active_recovery_id=target) THEN
        RAISE EXCEPTION 'Recovery cleanup unavailable' USING ERRCODE='23514';
    END IF;
    DELETE FROM public.offline_recovery_pages WHERE church_id=scope AND run_id=target;
    GET DIAGNOSTICS affected=ROW_COUNT;
    UPDATE public.offline_recovery_runs SET pages_purged_at=clock_timestamp() WHERE church_id=scope AND id=target;
    -- Correlation is metadata only, never an authorization capability.
    IF correlation IS NULL OR correlation !~ '^[a-f0-9-]{36}$' THEN correlation:=gen_random_uuid()::text; END IF;
    INSERT INTO public.audit_events(id,category,church_id,actor_type,actor_id,action,target_type,target_id,result,
        device_id,correlation_id,metadata_json,occurred_at)
        VALUES(gen_random_uuid(),'church',scope,'system',NULL,'offline.recovery.expired','system',target::text,'success',
            r.device_id,correlation::uuid,jsonb_build_object('count',affected),clock_timestamp());
    RETURN affected;
END $$;
