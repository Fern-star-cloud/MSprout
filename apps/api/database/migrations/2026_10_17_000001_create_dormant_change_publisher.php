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
            CREATE OR REPLACE FUNCTION public.append_coordinated_change(
                target_church uuid, expected_epoch uuid, expected_transaction text,
                ministry uuid, target_member uuid, entity_kind varchar, entity uuid,
                version integer, operation varchar, payload jsonb
            ) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
            DECLARE progress record; allocated bigint;
            BEGIN
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
            REVOKE ALL ON FUNCTION public.append_coordinated_change(uuid,uuid,text,uuid,uuid,varchar,uuid,integer,varchar,jsonb) FROM PUBLIC;
            SQL);
        // Construction only. Test-only execution grants are confined to the new guarded cluster.
        $db->statement('REVOKE ALL ON FUNCTION public.append_coordinated_change(uuid,uuid,text,uuid,uuid,varchar,uuid,integer,varchar,jsonb) FROM "'.$role.'"');
        // No progress initialization, legacy grant withdrawal, sequence alteration or caller cutover.
    }

    public function down(): void
    {
        throw new RuntimeException('Publication foundation rollback requires an explicitly reviewed operational plan.');
    }
};
