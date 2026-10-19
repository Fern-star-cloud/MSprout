-- Internal maintenance functions. No direct DELETE or broad runtime table grants.
CREATE OR REPLACE FUNCTION public.maintenance_church_ids() RETURNS SETOF uuid
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
    SELECT id FROM public.churches WHERE status IN ('active','suspended') ORDER BY id
$$;

CREATE OR REPLACE FUNCTION public.prune_global_operational_data(operational_cutoff timestamptz,security_cutoff timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE affected bigint; operational_count bigint:=0; security_count bigint:=0;
BEGIN
    IF operational_cutoff IS NULL OR security_cutoff IS NULL OR operational_cutoff>clock_timestamp()-interval '30 days'
        OR security_cutoff>clock_timestamp()-interval '180 days' THEN
        RAISE EXCEPTION 'Retention cutoff is newer than policy' USING ERRCODE='22023';
    END IF;
    LOOP
        DELETE FROM public.operational_events WHERE id IN(SELECT id FROM public.operational_events WHERE occurred_at<=operational_cutoff ORDER BY occurred_at,id LIMIT 1000);
        GET DIAGNOSTICS affected=ROW_COUNT; operational_count:=operational_count+affected; EXIT WHEN affected=0;
    END LOOP;
    LOOP
        DELETE FROM public.security_events WHERE id IN(SELECT id FROM public.security_events WHERE church_id IS NULL AND occurred_at<=security_cutoff ORDER BY occurred_at,id LIMIT 1000);
        GET DIAGNOSTICS affected=ROW_COUNT; security_count:=security_count+affected; EXIT WHEN affected=0;
    END LOOP;
    RETURN jsonb_build_object('operational_events',operational_count,'security_events',security_count);
END $$;

CREATE OR REPLACE FUNCTION public.prune_church_operational_data(target uuid,security_cutoff timestamptz,sync_cutoff timestamptz,feed_cutoff timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE affected bigint; security_count bigint:=0; sync_count bigint:=0; feed_count bigint:=0; removed_through bigint;
BEGIN
    IF target IS NULL OR target IS DISTINCT FROM NULLIF(current_setting('app.current_church_id',true),'')::uuid THEN
        RAISE EXCEPTION 'Maintenance church scope mismatch' USING ERRCODE='42501';
    END IF;
    IF security_cutoff IS NULL OR sync_cutoff IS NULL OR feed_cutoff IS NULL
        OR security_cutoff>clock_timestamp()-interval '180 days' OR sync_cutoff>clock_timestamp()-interval '180 days'
        OR feed_cutoff>clock_timestamp()-interval '90 days' THEN
        RAISE EXCEPTION 'Retention cutoff is newer than policy' USING ERRCODE='22023';
    END IF;
    PERFORM id FROM public.churches WHERE id=target AND status IN ('active','suspended') FOR NO KEY UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Maintenance church unavailable' USING ERRCODE='42501'; END IF;
    PERFORM church_id FROM public.sync_recovery_progress WHERE church_id=target FOR UPDATE;
    LOOP
        DELETE FROM public.security_events WHERE id IN(SELECT id FROM public.security_events WHERE church_id=target AND occurred_at<=security_cutoff ORDER BY occurred_at,id LIMIT 1000);
        GET DIAGNOSTICS affected=ROW_COUNT; security_count:=security_count+affected; EXIT WHEN affected=0;
    END LOOP;
    LOOP
        WITH gone AS (
            DELETE FROM public.sync_events WHERE id IN(SELECT id FROM public.sync_events WHERE church_id=target AND received_at<=sync_cutoff ORDER BY received_at,id LIMIT 1000)
            RETURNING device_id,received_at
        ), grouped AS (SELECT device_id,max(received_at) AS received_at FROM gone GROUP BY device_id), marked AS (
            UPDATE public.device_cursors d SET receipt_coverage='pruned',
                receipt_pruned_through=GREATEST(d.receipt_pruned_through,g.received_at),full_resync_required=true
            FROM grouped g WHERE d.church_id=target AND d.device_id=g.device_id RETURNING d.id
        ) SELECT count(*) INTO affected FROM gone;
        sync_count:=sync_count+affected; EXIT WHEN affected=0;
    END LOOP;
    -- Snapshot/reconstruction is not yet implemented. A served cursor, lease expiry or cleanup
    -- cannot prove that a device no longer needs history. Keep every such device's feed.
    IF NOT EXISTS(SELECT 1 FROM public.device_cursors WHERE church_id=target)
        AND NOT EXISTS(SELECT 1 FROM public.offline_authorizations WHERE church_id=target) THEN
        LOOP
            WITH gone AS (
                DELETE FROM public.change_feed WHERE sequence IN(SELECT sequence FROM public.change_feed WHERE church_id=target AND created_at<=feed_cutoff ORDER BY sequence LIMIT 1000)
                RETURNING sequence
            ) SELECT count(*),max(sequence) INTO affected,removed_through FROM gone;
            IF affected>0 THEN
                -- Unknown historical coverage stays NULL. Only advance an already-known watermark
                -- using rows actually deleted, never max served cursor or allocated sequence values.
                UPDATE public.sync_recovery_progress SET pruned_through=GREATEST(pruned_through,removed_through),updated_at=clock_timestamp()
                    WHERE church_id=target AND pruned_through IS NOT NULL;
            END IF;
            feed_count:=feed_count+affected; EXIT WHEN affected=0;
        END LOOP;
    END IF;
    RETURN jsonb_build_object('security_events',security_count,'sync_events',sync_count,'change_feed',feed_count);
END $$;

CREATE OR REPLACE FUNCTION public.purge_church_revoked_device_data(target uuid,secret_cutoff timestamptz,authorization_cutoff timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE marked_count bigint; secret_count bigint; authorization_count bigint:=0; affected bigint;
BEGIN
    IF target IS NULL OR target IS DISTINCT FROM NULLIF(current_setting('app.current_church_id',true),'')::uuid THEN
        RAISE EXCEPTION 'Maintenance church scope mismatch' USING ERRCODE='42501';
    END IF;
    IF secret_cutoff IS NULL OR authorization_cutoff IS NULL OR secret_cutoff>clock_timestamp()-interval '30 days'
        OR authorization_cutoff>clock_timestamp()-interval '180 days' THEN
        RAISE EXCEPTION 'Device cutoff is newer than policy' USING ERRCODE='22023';
    END IF;
    PERFORM id FROM public.churches WHERE id=target AND status IN ('active','suspended') FOR NO KEY UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Maintenance church unavailable' USING ERRCODE='42501'; END IF;
    UPDATE public.device_cursors d SET full_resync_required=true WHERE d.church_id=target AND NOT d.full_resync_required
        AND EXISTS(SELECT 1 FROM public.offline_authorizations a WHERE a.church_id=d.church_id AND a.membership_id=d.membership_id AND a.device_id=d.device_id AND (a.revoked_at IS NOT NULL OR a.expires_at<=clock_timestamp()));
    GET DIAGNOSTICS marked_count=ROW_COUNT;
    UPDATE public.push_subscriptions SET endpoint_hash=NULL,endpoint_ciphertext=NULL,p256dh_ciphertext=NULL,auth_ciphertext=NULL,updated_at=clock_timestamp()
        WHERE church_id=target AND endpoint_ciphertext IS NOT NULL AND COALESCE(revoked_at,expires_at)<=secret_cutoff;
    GET DIAGNOSTICS secret_count=ROW_COUNT;
    LOOP
        DELETE FROM public.offline_authorizations WHERE id IN(SELECT id FROM public.offline_authorizations WHERE church_id=target AND COALESCE(revoked_at,expires_at)<=authorization_cutoff ORDER BY COALESCE(revoked_at,expires_at),id LIMIT 1000);
        GET DIAGNOSTICS affected=ROW_COUNT;authorization_count:=authorization_count+affected;EXIT WHEN affected=0;
    END LOOP;
    RETURN jsonb_build_object('devices_marked',marked_count,'subscription_secrets_purged',secret_count,'authorizations_purged',authorization_count);
END $$;

-- Keep old internal SQL signatures compatible, with the same conservative guards and sorted gates.
CREATE OR REPLACE FUNCTION public.prune_operational_data(operational_cutoff timestamptz,security_cutoff timestamptz,sync_cutoff timestamptz,feed_cutoff timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE tenant uuid; global_counts jsonb; counts jsonb; security_count bigint; sync_count bigint:=0; feed_count bigint:=0; previous_scope text:=current_setting('app.current_church_id',true);
BEGIN
    global_counts:=public.prune_global_operational_data(operational_cutoff,security_cutoff);security_count:=(global_counts->>'security_events')::bigint;
    FOR tenant IN SELECT public.maintenance_church_ids() LOOP
        PERFORM set_config('app.current_church_id',tenant::text,true);
        counts:=public.prune_church_operational_data(tenant,security_cutoff,sync_cutoff,feed_cutoff);
        security_count:=security_count+(counts->>'security_events')::bigint;sync_count:=sync_count+(counts->>'sync_events')::bigint;feed_count:=feed_count+(counts->>'change_feed')::bigint;
    END LOOP;
    PERFORM set_config('app.current_church_id',COALESCE(previous_scope,''),true);
    RETURN jsonb_build_object('operational_events',(global_counts->>'operational_events')::bigint,'security_events',security_count,'sync_events',sync_count,'change_feed',feed_count);
END $$;
CREATE OR REPLACE FUNCTION public.purge_revoked_device_data(secret_cutoff timestamptz,authorization_cutoff timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE tenant uuid; counts jsonb; marked bigint:=0; secrets bigint:=0; authorizations bigint:=0; previous_scope text:=current_setting('app.current_church_id',true);
BEGIN
    FOR tenant IN SELECT public.maintenance_church_ids() LOOP
        PERFORM set_config('app.current_church_id',tenant::text,true);
        counts:=public.purge_church_revoked_device_data(tenant,secret_cutoff,authorization_cutoff);
        marked:=marked+(counts->>'devices_marked')::bigint;secrets:=secrets+(counts->>'subscription_secrets_purged')::bigint;authorizations:=authorizations+(counts->>'authorizations_purged')::bigint;
    END LOOP;
    PERFORM set_config('app.current_church_id',COALESCE(previous_scope,''),true);
    RETURN jsonb_build_object('devices_marked',marked,'subscription_secrets_purged',secrets,'authorizations_purged',authorizations);
END $$;
REVOKE ALL ON FUNCTION public.maintenance_church_ids(),public.prune_global_operational_data(timestamptz,timestamptz),public.prune_church_operational_data(uuid,timestamptz,timestamptz,timestamptz),public.purge_church_revoked_device_data(uuid,timestamptz,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.maintenance_church_ids(),public.prune_global_operational_data(timestamptz,timestamptz),public.prune_church_operational_data(uuid,timestamptz,timestamptz,timestamptz),public.purge_church_revoked_device_data(uuid,timestamptz,timestamptz) TO "__RUNTIME_ROLE__";

CREATE OR REPLACE FUNCTION public.protected_user_has_memberships(target bigint) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
    SELECT EXISTS(SELECT 1 FROM public.church_memberships WHERE user_id=target)
$$;
REVOKE ALL ON FUNCTION public.protected_user_has_memberships(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.protected_user_has_memberships(bigint) TO "__RUNTIME_ROLE__";
