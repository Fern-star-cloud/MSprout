-- Owner-only operational cutover. Migrations construct this machinery but do not run it.
CREATE TABLE sync_publication_control (
    singleton boolean PRIMARY KEY CHECK(singleton),
    active boolean NOT NULL DEFAULT false,
    activated_at timestamptz(6),
    sealed_database_xid text,
    legacy_verifier_digest char(64),
    CHECK (active = (activated_at IS NOT NULL))
);
INSERT INTO sync_publication_control(singleton,active) VALUES(true,false);
REVOKE ALL ON sync_publication_control FROM PUBLIC;
GRANT SELECT(singleton,active,activated_at) ON sync_publication_control TO "__RUNTIME_ROLE__";

-- Catalog xmin is 32-bit; expand it against a recent full xid before checking commit status.
-- Direct xmin::xid8 casts lose the epoch after PostgreSQL transaction-ID wraparound.
CREATE OR REPLACE FUNCTION public.publication_full_xid(transaction xid, reference xid8 DEFAULT pg_current_xact_id())
RETURNS xid8 LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE full_value numeric;
BEGIN
    full_value:=floor(reference::text::numeric/4294967296)*4294967296+transaction::text::numeric;
    IF full_value>reference::text::numeric THEN full_value:=full_value-4294967296; END IF;
    IF full_value<0 THEN RETURN NULL; END IF;
    RETURN full_value::text::xid8;
END $$;
REVOKE ALL ON FUNCTION public.publication_full_xid(xid,xid8) FROM PUBLIC,"__RUNTIME_ROLE__";

-- Private comparison evidence, never a reusable credential or a runtime-readable value.
CREATE OR REPLACE FUNCTION public.record_publication_admission_seal() RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE database_xid text; verifier text;
BEGIN
    IF current_user::regrole <> (SELECT relowner FROM pg_class WHERE oid='public.change_feed'::regclass)
        OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN
        RAISE EXCEPTION 'Qualified migration owner required' USING ERRCODE='42501';
    END IF;
    SELECT public.publication_full_xid(xmin)::text INTO database_xid FROM pg_database WHERE datname=current_database() AND NOT datallowconn AND pg_xact_status(public.publication_full_xid(xmin))='committed';
    SELECT rolpassword INTO verifier FROM pg_authid WHERE rolname='__RUNTIME_ROLE__' AND NOT rolcanlogin;
    IF database_xid IS NULL OR verifier IS NULL OR verifier NOT LIKE 'SCRAM-SHA-256$%'
        OR EXISTS(SELECT 1 FROM public.sync_publication_control WHERE active) OR EXISTS(SELECT 1 FROM public.sync_recovery_progress) THEN
        RAISE EXCEPTION 'Fresh committed admission seal and inactive publication required' USING ERRCODE='55000';
    END IF;
    INSERT INTO public.sync_publication_control(singleton,active,sealed_database_xid,legacy_verifier_digest)
        VALUES(true,false,database_xid,encode(sha256(convert_to(verifier,'UTF8')),'hex'))
        ON CONFLICT(singleton) DO UPDATE SET sealed_database_xid=excluded.sealed_database_xid,legacy_verifier_digest=excluded.legacy_verifier_digest;
END $$;
REVOKE ALL ON FUNCTION public.record_publication_admission_seal() FROM PUBLIC,"__RUNTIME_ROLE__";

CREATE OR REPLACE FUNCTION public.activate_coordinated_publication(correlation uuid)
RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE
    runtime_oid oid; tenant record; floor_value bigint; head_value bigint;
    previous_scope text := current_setting('app.current_church_id',true);
    initialized integer := 0;
BEGIN
    IF correlation IS NULL OR current_user::regrole <> (SELECT relowner FROM pg_class WHERE oid='public.change_feed'::regclass)
        OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN
        RAISE EXCEPTION 'Qualified migration owner required' USING ERRCODE='42501';
    END IF;
    -- Admission must be sealed in a prior committed transaction. A new-writer-only lock is insufficient.
    IF NOT EXISTS(SELECT 1 FROM pg_database WHERE datname=current_database() AND NOT datallowconn
        AND pg_xact_status(public.publication_full_xid(xmin))='committed') THEN
        RAISE EXCEPTION 'Committed database admission seal required' USING ERRCODE='55000';
    END IF;
    SELECT oid INTO runtime_oid FROM pg_roles WHERE rolname='__RUNTIME_ROLE__' AND NOT rolcanlogin
        AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolinherit AND NOT rolreplication;
    IF runtime_oid IS NULL OR EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid=runtime_oid OR member=runtime_oid) THEN
        RAISE EXCEPTION 'Dedicated sealed restricted runtime required' USING ERRCODE='55000';
    END IF;
    IF EXISTS(SELECT 1 FROM pg_hba_file_rules WHERE error IS NOT NULL)
        OR EXISTS(SELECT 1 FROM pg_hba_file_rules WHERE type LIKE 'host%' AND auth_method NOT IN('scram-sha-256','reject'))
        OR EXISTS(SELECT 1 FROM pg_hba_file_rules WHERE type='local' AND database<>ARRAY['replication']::text[]
            AND user_name IS DISTINCT FROM ARRAY[current_user::text] AND auth_method NOT IN('scram-sha-256','reject')) THEN
        RAISE EXCEPTION 'Runtime authentication ingress cannot prove credential fencing' USING ERRCODE='55000';
    END IF;
    IF NOT EXISTS(
        SELECT 1 FROM public.sync_publication_control c JOIN pg_database d ON d.datname=current_database()
        JOIN pg_authid a ON a.rolname='__RUNTIME_ROLE__'
        WHERE c.sealed_database_xid=public.publication_full_xid(d.xmin)::text AND c.legacy_verifier_digest IS NOT NULL
          AND a.rolpassword LIKE 'SCRAM-SHA-256$%'
          AND c.legacy_verifier_digest<>encode(sha256(convert_to(a.rolpassword,'UTF8')),'hex')
    ) THEN
        RAISE EXCEPTION 'Fresh runtime credential rotation after the recorded seal required' USING ERRCODE='55000';
    END IF;
    IF EXISTS(SELECT 1 FROM pg_class c,aclexplode(c.relacl) a
        WHERE c.oid IN ('public.change_feed'::regclass,'public.sync_recovery_progress'::regclass)
          AND a.grantee NOT IN(c.relowner,runtime_oid) AND a.privilege_type IN('INSERT','UPDATE','DELETE','TRUNCATE'))
        OR EXISTS(SELECT 1 FROM pg_class c,aclexplode(c.relacl) a WHERE c.oid='public.change_feed_sequence_seq'::regclass
          AND a.grantee NOT IN(c.relowner,runtime_oid) AND a.privilege_type IN('USAGE','SELECT','UPDATE'))
        OR EXISTS(SELECT 1 FROM pg_class c,aclexplode(c.relacl) a WHERE c.oid='public.change_feed'::regclass
          AND a.grantee=runtime_oid AND a.privilege_type IN('UPDATE','DELETE','TRUNCATE'))
        OR EXISTS(SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid CROSS JOIN LATERAL aclexplode(a.attacl) p
          WHERE (a.attrelid='public.change_feed'::regclass AND p.grantee<>c.relowner AND p.privilege_type IN('INSERT','UPDATE'))
             OR (a.attrelid='public.sync_recovery_progress'::regclass AND p.grantee NOT IN(c.relowner,runtime_oid) AND p.privilege_type IN('INSERT','UPDATE'))) THEN
        RAISE EXCEPTION 'Unqualified additional direct writer privileges remain' USING ERRCODE='55000';
    END IF;
    IF EXISTS(SELECT 1 FROM pg_stat_activity WHERE datid=(SELECT oid FROM pg_database WHERE datname=current_database()) AND pid<>pg_backend_pid())
        OR EXISTS(SELECT 1 FROM pg_prepared_xacts WHERE database=current_database()) THEN
        RAISE EXCEPTION 'Old database writers or prepared transactions remain' USING ERRCODE='55000';
    END IF;
    IF EXISTS(SELECT 1 FROM pg_proc p,aclexplode(p.proacl) a WHERE p.oid='public.append_coordinated_change(uuid,uuid,text,uuid,uuid,character varying,uuid,integer,character varying,jsonb)'::regprocedure
        AND a.grantee<>p.proowner AND a.privilege_type='EXECUTE')
        OR EXISTS(SELECT 1 FROM public.sync_recovery_progress)
        OR EXISTS(SELECT 1 FROM public.sync_publication_control WHERE active) THEN
        RAISE EXCEPTION 'Existing or mixed publication state requires separate investigation' USING ERRCODE='55000';
    END IF;
    IF (SELECT seqcache FROM pg_sequence WHERE seqrelid='public.change_feed_sequence_seq'::regclass)<>1 THEN
        RAISE EXCEPTION 'Drain cached consumers and qualify CACHE 1 first' USING ERRCODE='55000';
    END IF;
    LOCK TABLE public.churches,public.change_feed,public.sync_recovery_progress IN ACCESS EXCLUSIVE MODE;
    SELECT CASE WHEN is_called THEN last_value ELSE 0 END INTO floor_value FROM public.change_feed_sequence_seq;
    FOR tenant IN SELECT id FROM public.churches ORDER BY id LOOP
        PERFORM set_config('app.current_church_id',tenant.id::text,true);
        SELECT COALESCE(max(sequence),0) INTO head_value FROM public.change_feed WHERE church_id=tenant.id;
        IF head_value>floor_value THEN
            RAISE EXCEPTION 'Sequence allocation floor is below retained data' USING ERRCODE='55000';
        END IF;
        INSERT INTO public.sync_recovery_progress(church_id,feed_head,baseline_sequence_floor,pruned_through,coverage_epoch,history_baselined_at,updated_at)
            VALUES(tenant.id,head_value,floor_value,NULL,gen_random_uuid(),clock_timestamp(),clock_timestamp());
        UPDATE public.device_cursors SET full_resync_required=true WHERE church_id=tenant.id;
        initialized:=initialized+1;
    END LOOP;
    REVOKE INSERT ON public.change_feed FROM "__RUNTIME_ROLE__";
    REVOKE ALL ON SEQUENCE public.change_feed_sequence_seq FROM "__RUNTIME_ROLE__";
    REVOKE UPDATE ON public.sync_recovery_progress FROM "__RUNTIME_ROLE__";
    REVOKE UPDATE(feed_head,pruned_through,updated_at) ON public.sync_recovery_progress FROM "__RUNTIME_ROLE__";
    GRANT EXECUTE ON FUNCTION public.append_coordinated_change(uuid,uuid,text,uuid,uuid,varchar,uuid,integer,varchar,jsonb) TO "__RUNTIME_ROLE__";
    INSERT INTO public.sync_publication_control(singleton,active,activated_at) VALUES(true,true,clock_timestamp())
        ON CONFLICT(singleton) DO UPDATE SET active=true,activated_at=excluded.activated_at;
    PERFORM set_config('app.current_church_id',COALESCE(previous_scope,''),true);
    INSERT INTO public.audit_events(id,category,church_id,actor_type,actor_id,action,target_type,target_id,result,correlation_id,metadata_json,occurred_at)
        VALUES(gen_random_uuid(),'platform',NULL,'system',NULL,'sync.publication.activated','system',NULL,'success',correlation,jsonb_build_object('count',initialized),clock_timestamp());
    RETURN jsonb_build_object('churches',initialized,'allocation_floor',floor_value::text,'history_coverage','unknown');
END $$;
REVOKE ALL ON FUNCTION public.activate_coordinated_publication(uuid) FROM PUBLIC,"__RUNTIME_ROLE__";

CREATE OR REPLACE FUNCTION public.initialize_new_church_publication() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE floor_value bigint;
BEGIN
    IF NOT EXISTS(SELECT 1 FROM public.sync_publication_control WHERE active) THEN RETURN NEW; END IF;
    IF NEW.id IS DISTINCT FROM NULLIF(current_setting('app.current_church_id',true),'')::uuid THEN
        RAISE EXCEPTION 'New church provisioning scope required' USING ERRCODE='42501';
    END IF;
    IF (SELECT seqcache FROM pg_sequence WHERE seqrelid='public.change_feed_sequence_seq'::regclass)<>1 THEN
        RAISE EXCEPTION 'Genesis requires cache one' USING ERRCODE='55000';
    END IF;
    SELECT CASE WHEN is_called THEN last_value ELSE 0 END INTO floor_value FROM public.change_feed_sequence_seq;
    -- Only an actual INSERT fires this trigger. No existing church is silently baselined.
    INSERT INTO public.sync_recovery_progress(church_id,feed_head,baseline_sequence_floor,pruned_through,coverage_epoch,history_baselined_at,updated_at)
        VALUES(NEW.id,0,floor_value,0,gen_random_uuid(),clock_timestamp(),clock_timestamp());
    -- Existing deferred exactly-one-Owner constraints and platform decision audit own the same transaction.
    RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.initialize_new_church_publication() FROM PUBLIC,"__RUNTIME_ROLE__";
CREATE TRIGGER coordinated_new_church_genesis AFTER INSERT ON public.churches
    FOR EACH ROW EXECUTE FUNCTION public.initialize_new_church_publication();

CREATE OR REPLACE FUNCTION public.append_coordinated_change(
                target_church uuid, expected_epoch uuid, expected_transaction text,
                ministry uuid, target_member uuid, entity_kind varchar, entity uuid,
                version integer, operation varchar, payload jsonb
            ) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
            DECLARE progress record; allocated bigint;
            BEGIN
                IF NOT EXISTS(SELECT 1 FROM public.sync_publication_control WHERE active) THEN
                    RAISE EXCEPTION 'Coordinated publication is inactive' USING ERRCODE='55000';
                END IF;
                IF target_church IS NULL OR target_church IS DISTINCT FROM NULLIF(current_setting('app.current_church_id',true),'')::uuid
                    OR expected_transaction IS DISTINCT FROM pg_current_xact_id()::text THEN
                    RAISE EXCEPTION 'Publication scope or transaction mismatch' USING ERRCODE='42501';
                END IF;
                -- Independently enforce gate-before-progress/allocation at the SQL boundary.
                -- This is not proof of HTTP/session authority or earlier domain lock order.
                PERFORM id FROM public.churches WHERE id=target_church AND status='active' FOR NO KEY UPDATE;
                IF NOT FOUND THEN RAISE EXCEPTION 'Publication church unavailable' USING ERRCODE='42501'; END IF;
                SELECT * INTO progress FROM public.sync_recovery_progress WHERE church_id=target_church FOR UPDATE;
                IF NOT FOUND OR progress.history_baselined_at IS NULL OR expected_epoch IS NULL
                    OR progress.coverage_epoch IS DISTINCT FROM expected_epoch THEN
                    RAISE EXCEPTION 'Qualified publication metadata required' USING ERRCODE='55000';
                END IF;
                -- CACHE>1 permits a later gate holder to consume a lower cached value.
                -- Refuse it; never reset/reseed the sequence or guess committed coverage.
                IF (SELECT seqcache FROM pg_catalog.pg_sequence WHERE seqrelid='public.change_feed_sequence_seq'::regclass) IS DISTINCT FROM 1::bigint THEN
                    RAISE EXCEPTION 'Publication requires sequence cache one' USING ERRCODE='55000';
                END IF;
                IF ministry IS NULL OR entity IS NULL OR version IS NULL OR version<1 OR entity_kind IS NULL OR operation IS NULL
                    OR payload IS NULL OR jsonb_typeof(payload)<>'object' THEN
                    RAISE EXCEPTION 'Unsupported publication fields' USING ERRCODE='22023';
                END IF;
                IF entity_kind='ministry_assignment' AND operation='tombstone' THEN
                    IF target_member IS NULL OR payload->>'ministry_id' IS DISTINCT FROM ministry::text THEN
                        RAISE EXCEPTION 'Invalid assignment publication' USING ERRCODE='22023';
                    END IF;
                ELSIF entity_kind='attendance_session' AND operation='upsert' THEN
                    IF target_member IS NOT NULL OR payload->>'id' IS DISTINCT FROM entity::text
                        OR payload->>'ministry_id' IS DISTINCT FROM ministry::text OR payload->>'version' IS DISTINCT FROM version::text
                        OR NOT (payload ?& ARRAY['attendance_date','status','finalized_at','deleted_at','records','guests'])
                        OR jsonb_typeof(payload->'attendance_date') IS DISTINCT FROM 'string'
                        OR COALESCE(payload->>'attendance_date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
                        OR COALESCE(payload->>'status','') NOT IN ('draft','finalized_pending','finalized','needs_review','revised')
                        OR jsonb_typeof(payload->'records') IS DISTINCT FROM 'array' OR jsonb_typeof(payload->'guests') IS DISTINCT FROM 'array' THEN
                        RAISE EXCEPTION 'Invalid attendance publication' USING ERRCODE='22023';
                    END IF;
                ELSE
                    RAISE EXCEPTION 'Unsupported publication kind or action' USING ERRCODE='22023';
                END IF;
                -- Composite FKs additionally enforce ministry/member tenant ownership.
                allocated := nextval('public.change_feed_sequence_seq'::regclass);
                IF allocated <= GREATEST(progress.feed_head,progress.baseline_sequence_floor) THEN
                    RAISE EXCEPTION 'Publication allocation precedes qualified boundary' USING ERRCODE='55000';
                END IF;
                INSERT INTO public.change_feed(sequence,id,church_id,ministry_id,target_membership_id,entity_type,entity_id,entity_version,action,payload_json,created_at)
                    VALUES(allocated,gen_random_uuid(),target_church,ministry,target_member,entity_kind,entity,version,operation,payload,clock_timestamp());
                UPDATE public.sync_recovery_progress SET feed_head=allocated,updated_at=clock_timestamp() WHERE church_id=target_church;
                RETURN allocated;
            END $$;
