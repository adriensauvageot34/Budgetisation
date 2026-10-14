-- SNAP-3 tranche B. Additive private owner outputs, no financial row changes.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regprocedure('private.activity_history_scope_allowed(jsonb,uuid)') IS NULL
 OR to_regprocedure('private.activity_history_canonical_json(jsonb)') IS NULL THEN RAISE EXCEPTION 'BASIS_PRECONDITION'; END IF;
 IF to_regclass('private.composer_historical_basis_state') IS NOT NULL THEN RAISE EXCEPTION 'BASIS_ALREADY_INSTALLED'; END IF;
END $$;
CREATE TABLE private.composer_historical_basis_state (
 singleton boolean PRIMARY KEY CHECK(singleton), revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 schema_epoch bigint NOT NULL DEFAULT 1 CHECK(schema_epoch>0), enabled boolean NOT NULL DEFAULT true,
 writer_signature text NOT NULL DEFAULT '', view_signatures jsonb NOT NULL DEFAULT '{}'::jsonb
);
INSERT INTO private.composer_historical_basis_state(singleton) VALUES(true);
CREATE TABLE private.composer_historical_basis_artifacts (
 scope_key text PRIMARY KEY CHECK(scope_key~'^[a-f0-9]{64}$'),
 owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 household_id uuid NOT NULL REFERENCES public.households(household_id) ON DELETE RESTRICT,
 generation bigint NOT NULL CHECK(generation>0), artifact jsonb NOT NULL,
 published_at timestamptz NOT NULL DEFAULT now(), CHECK(octet_length(artifact::text)<=2097152)
);
CREATE INDEX composer_historical_basis_author ON private.composer_historical_basis_artifacts(owner_user_id);
CREATE INDEX composer_historical_basis_household ON private.composer_historical_basis_artifacts(household_id);
ALTER TABLE private.composer_historical_basis_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.composer_historical_basis_artifacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.composer_historical_basis_state,private.composer_historical_basis_artifacts FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION private.composer_basis_sources() RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT ARRAY['public.operations','public.operation_allocations','public.operation_items','public.payment_components',
 'public.cash_economic_uses','public.refund_allocations','public.economic_consumption_segments','public.operation_place_links',
 'public.financial_source_person_links','public.categories','public.subcategories','public.merchants',
 'public.purchase_events','public.purchase_event_memberships','public.purchase_event_timing_assertions',
 'public.purchase_economic_components','public.purchase_event_classification_assertions','public.economic_component_classifications',
 'public.households','public.persons','private.household_memberships','public.analysis_periods']::text[];
$$;
CREATE FUNCTION private.composer_basis_view_signatures() RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_object_agg(name,md5(pg_get_viewdef(name::regclass,true))) FROM unnest(ARRAY[
 'public.canonical_household_scope_control','public.financial_bank_cost_canonical','public.financial_refund_source_canonical',
 'public.financial_economic_cost_canonical','public.financial_economic_timing_canonical','public.financial_economic_timing_control',
 'public.financial_canonical_reconciliation_control','public.operation_place_canonical']) AS name;
$$;
CREATE FUNCTION private.bump_composer_historical_basis() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE private.composer_historical_basis_state SET revision=revision+1 WHERE singleton;
 IF NOT FOUND THEN RAISE EXCEPTION 'BASIS_VERSION_UNAVAILABLE'; END IF;
 RETURN NULL;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY private.composer_basis_sources() LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=t::regclass AND relkind='r' AND NOT relispartition) THEN RAISE EXCEPTION 'BASIS_SOURCE_PRECONDITION'; END IF;
  EXECUTE format('CREATE TRIGGER snap3_historical_basis_version AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON %s FOR EACH STATEMENT EXECUTE FUNCTION private.bump_composer_historical_basis()',t);
  EXECUTE format('ALTER TABLE %s ENABLE ALWAYS TRIGGER snap3_historical_basis_version',t);
 END LOOP;
END $$;
UPDATE private.composer_historical_basis_state SET writer_signature=md5(pg_get_functiondef('private.bump_composer_historical_basis()'::regprocedure)),view_signatures=private.composer_basis_view_signatures();
CREATE FUNCTION private.composer_basis_configuration_fence() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.enabled IS DISTINCT FROM OLD.enabled OR NEW.schema_epoch IS DISTINCT FROM OLD.schema_epoch
 OR NEW.writer_signature IS DISTINCT FROM OLD.writer_signature OR NEW.view_signatures IS DISTINCT FROM OLD.view_signatures THEN
  NEW.revision:=greatest(NEW.revision,OLD.revision+1); END IF;
 IF NEW.revision<OLD.revision THEN RAISE EXCEPTION 'BASIS_REVISION_REGRESSION'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER snap3_configuration_fence BEFORE UPDATE ON private.composer_historical_basis_state FOR EACH ROW EXECUTE FUNCTION private.composer_basis_configuration_fence();
CREATE FUNCTION private.composer_basis_writer_coverage() RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT (SELECT writer_signature=md5(pg_get_functiondef('private.bump_composer_historical_basis()'::regprocedure))
 AND view_signatures=private.composer_basis_view_signatures() FROM private.composer_historical_basis_state WHERE singleton)
 AND (SELECT count(*)=cardinality(private.composer_basis_sources()) FROM pg_trigger t
 WHERE t.tgrelid=ANY(ARRAY(SELECT source::regclass FROM unnest(private.composer_basis_sources()) source))
 AND t.tgname='snap3_historical_basis_version' AND t.tgenabled='A' AND t.tgtype=60 AND NOT t.tgisinternal
 AND t.tgnargs=0 AND t.tgqual IS NULL AND t.tgfoid='private.bump_composer_historical_basis()'::regprocedure);
$$;
CREATE FUNCTION private.composer_basis_scope_allowed(s jsonb,actor uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT s->>'method'='composer-canonical-basis@v1' AND s->>'cutoffDate'=s->>'endExclusive'
 AND private.activity_history_scope_allowed(jsonb_set(s,'{method}','"canonical-activity-projection@snap1-v1"'::jsonb),actor);
$$;
CREATE FUNCTION private.composer_basis_proof(r bigint,e bigint) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT jsonb_build_object('coverage','composer-canonical-writers@v1','revision',r::text,'schemaEpoch',e::text);
$$;
CREATE FUNCTION public.inspect_composer_historical_basis_v1(p_scope jsonb,p_key text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE st private.composer_historical_basis_state%ROWTYPE; a private.composer_historical_basis_artifacts%ROWTYPE;
BEGIN
 IF private.composer_basis_scope_allowed(p_scope,(SELECT auth.uid())) IS NOT TRUE
 OR private.user_has_household_access((p_scope->>'householdId')::uuid) IS NOT TRUE
 OR p_key IS DISTINCT FROM encode(sha256(convert_to(private.activity_history_canonical_json(p_scope),'UTF8')),'hex') THEN
  RAISE EXCEPTION 'BASIS_SCOPE_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT st FROM private.composer_historical_basis_state WHERE singleton;
 IF NOT st.enabled OR NOT private.composer_basis_writer_coverage() THEN RETURN jsonb_build_object('proof',NULL,'generation',0,'artifact',NULL); END IF;
 SELECT * INTO a FROM private.composer_historical_basis_artifacts WHERE scope_key=p_key;
 IF FOUND AND (a.owner_user_id<>(SELECT auth.uid()) OR a.household_id<>(p_scope->>'householdId')::uuid) THEN RAISE EXCEPTION 'BASIS_SCOPE_CORRUPT'; END IF;
 RETURN jsonb_build_object('proof',private.composer_basis_proof(st.revision,st.schema_epoch),'generation',coalesce(a.generation,0),
 -- Do not transfer an inadmissible stale body. Preserve its generation for CAS.
 'artifact',CASE WHEN a.artifact->'proof'=private.composer_basis_proof(st.revision,st.schema_epoch) THEN a.artifact ELSE NULL END);
END $$;
CREATE FUNCTION public.publish_composer_historical_basis_v1(p_scope jsonb,p_key text,p_expected_generation bigint,p_artifact jsonb)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE st private.composer_historical_basis_state%ROWTYPE; g bigint;
BEGIN
 SET LOCAL lock_timeout='2s';
 IF private.composer_basis_scope_allowed(p_scope,(p_scope->>'userId')::uuid) IS NOT TRUE
 OR p_key IS DISTINCT FROM encode(sha256(convert_to(private.activity_history_canonical_json(p_scope),'UTF8')),'hex') THEN RAISE EXCEPTION 'BASIS_SCOPE_DENIED' USING ERRCODE='42501'; END IF;
 IF p_expected_generation IS NULL OR p_expected_generation<0 OR p_expected_generation>=9007199254740991
 OR jsonb_typeof(p_artifact) IS DISTINCT FROM 'object' OR octet_length(p_artifact::text)>2097152
 OR (SELECT count(*) FROM jsonb_object_keys(p_artifact))<>9
 OR NOT p_artifact ?& ARRAY['scope','proof','generation','status','codec','payload','payloadBytes','payloadDigest','digest']
 OR p_artifact->'scope' IS DISTINCT FROM p_scope OR p_artifact->>'status' IS DISTINCT FROM 'READY'
 OR p_artifact->>'codec' IS DISTINCT FROM 'deflate-raw-json@1'
 OR jsonb_typeof(p_artifact->'payload') IS DISTINCT FROM 'string'
 OR jsonb_typeof(p_artifact->'payloadBytes') IS DISTINCT FROM 'number'
 OR (p_artifact->>'payloadBytes')::bigint NOT BETWEEN 0 AND 8388608
 OR coalesce(p_artifact->>'payloadDigest','')!~'^[a-f0-9]{64}$'
 OR p_artifact->>'digest' IS DISTINCT FROM encode(sha256(convert_to(private.activity_history_canonical_json(p_artifact-'digest'),'UTF8')),'hex') THEN
  RAISE EXCEPTION 'BASIS_PAYLOAD_INVALID' USING ERRCODE='23514'; END IF;
 SELECT * INTO STRICT st FROM private.composer_historical_basis_state WHERE singleton FOR UPDATE;
 IF NOT st.enabled OR NOT private.composer_basis_writer_coverage() THEN RETURN false; END IF;
 IF private.composer_basis_scope_allowed(p_scope,(p_scope->>'userId')::uuid) IS NOT TRUE THEN RAISE EXCEPTION 'BASIS_SCOPE_DENIED' USING ERRCODE='42501'; END IF;
 IF p_artifact->'proof' IS DISTINCT FROM private.composer_basis_proof(st.revision,st.schema_epoch) THEN RETURN false; END IF;
 SELECT generation INTO g FROM private.composer_historical_basis_artifacts WHERE scope_key=p_key;
 IF coalesce(g,0) IS DISTINCT FROM p_expected_generation OR p_artifact->'generation' IS DISTINCT FROM to_jsonb(p_expected_generation+1) THEN RETURN false; END IF;
 INSERT INTO private.composer_historical_basis_artifacts(scope_key,owner_user_id,household_id,generation,artifact)
 VALUES(p_key,(p_scope->>'userId')::uuid,(p_scope->>'householdId')::uuid,p_expected_generation+1,p_artifact)
 ON CONFLICT(scope_key) DO UPDATE SET generation=excluded.generation,artifact=excluded.artifact,published_at=now();
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION private.composer_basis_sources(),private.composer_basis_view_signatures(),private.bump_composer_historical_basis(),
 private.composer_basis_configuration_fence(),private.composer_basis_writer_coverage(),private.composer_basis_scope_allowed(jsonb,uuid),private.composer_basis_proof(bigint,bigint)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.inspect_composer_historical_basis_v1(jsonb,text),public.publish_composer_historical_basis_v1(jsonb,text,bigint,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.inspect_composer_historical_basis_v1(jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_composer_historical_basis_v1(jsonb,text,bigint,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
