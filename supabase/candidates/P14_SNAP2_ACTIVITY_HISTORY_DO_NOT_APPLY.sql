-- REVIEW CANDIDATE ONLY. Not in migrations/, never applied remotely by SNAP-2.
-- One owner. No Global/Forecast revision, publication or financial row is written.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$ DECLARE t text; BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'SNAP2_EXPECTED_MIGRATION_OWNER_POSTGRES'; END IF;
 IF to_regprocedure('auth.uid()') IS NULL OR to_regprocedure('private.user_has_household_access(uuid)') IS NULL
    OR to_regclass('private.household_memberships') IS NULL THEN RAISE EXCEPTION 'SNAP2_AUTH_PRECONDITION'; END IF;
 FOREACH t IN ARRAY ARRAY['life_events','life_event_types','life_event_participations','life_event_financial_links','households','persons'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=t AND c.relkind='r' AND NOT c.relispartition) THEN
   RAISE EXCEPTION 'SNAP2_SOURCE_PRECONDITION';
  END IF;
 END LOOP;
 IF to_regclass('private.planner_activity_history_state') IS NOT NULL THEN RAISE EXCEPTION 'SNAP2_ALREADY_INSTALLED'; END IF;
END $$;
CREATE TABLE private.planner_activity_history_state (
 singleton boolean PRIMARY KEY CHECK(singleton), revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 schema_epoch bigint NOT NULL DEFAULT 1 CHECK(schema_epoch>0), enabled boolean NOT NULL DEFAULT false,
 writer_signature text NOT NULL DEFAULT ''
);
INSERT INTO private.planner_activity_history_state(singleton) VALUES(true);
CREATE TABLE private.planner_activity_history_artifacts (
 scope_key text PRIMARY KEY CHECK(scope_key~'^[a-f0-9]{64}$'), owner_user_id uuid NOT NULL REFERENCES auth.users(id),
 household_id uuid NOT NULL REFERENCES public.households(household_id), generation bigint NOT NULL CHECK(generation>0),
 artifact jsonb NOT NULL, published_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.planner_activity_history_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.planner_activity_history_artifacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.planner_activity_history_state, private.planner_activity_history_artifacts FROM PUBLIC,anon,authenticated,service_role;

-- Needed because an ordinary canonical DML writer has no access to private state.
-- No callable client mutation path: fixed singleton increment, no user arguments.
CREATE FUNCTION private.bump_planner_activity_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE private.planner_activity_history_state SET revision=revision+1 WHERE singleton;
 IF NOT FOUND THEN RAISE EXCEPTION 'SNAP2_VERSION_UNAVAILABLE'; END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.bump_planner_activity_history() FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE t text; s text; BEGIN
 FOREACH t IN ARRAY ARRAY['life_events','life_event_types','life_event_participations','life_event_financial_links','households','persons','household_memberships'] LOOP
  s:=CASE WHEN t='household_memberships' THEN 'private' ELSE 'public' END;
  EXECUTE format('CREATE TRIGGER snap2_activity_history_version AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON %I.%I
   FOR EACH STATEMENT EXECUTE FUNCTION private.bump_planner_activity_history()',s,t);
  EXECUTE format('ALTER TABLE %I.%I ENABLE ALWAYS TRIGGER snap2_activity_history_version',s,t);
 END LOOP;
END $$;
UPDATE private.planner_activity_history_state SET writer_signature=md5(pg_get_functiondef('private.bump_planner_activity_history()'::regprocedure));

-- The deployment protocol MUST disable consumption before DDL/method changes.
-- Changes to activation/epoch/signature cannot revive an old artifact silently.
CREATE FUNCTION private.fence_planner_activity_history_configuration() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NEW.enabled IS DISTINCT FROM OLD.enabled OR NEW.schema_epoch IS DISTINCT FROM OLD.schema_epoch
    OR NEW.writer_signature IS DISTINCT FROM OLD.writer_signature THEN NEW.revision:=greatest(NEW.revision,OLD.revision+1); END IF;
 IF NEW.revision<OLD.revision THEN RAISE EXCEPTION 'SNAP2_REVISION_REGRESSION'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER snap2_configuration_fence BEFORE UPDATE ON private.planner_activity_history_state
 FOR EACH ROW EXECUTE FUNCTION private.fence_planner_activity_history_configuration();
REVOKE ALL ON FUNCTION private.fence_planner_activity_history_configuration() FROM PUBLIC,anon,authenticated,service_role;

-- Canonical JSON only for the finite JSON envelope (strings and safe integers).
CREATE FUNCTION private.activity_history_canonical_json(v jsonb) RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $$
 SELECT CASE jsonb_typeof(v)
 WHEN 'object' THEN '{'||coalesce((SELECT string_agg(to_jsonb(key)::text||':'||private.activity_history_canonical_json(value),',' ORDER BY key COLLATE "C") FROM jsonb_each(v)),'')||'}'
 WHEN 'array' THEN '['||coalesce((SELECT string_agg(private.activity_history_canonical_json(value),',' ORDER BY ordinality) FROM jsonb_array_elements(v) WITH ORDINALITY),'')||']'
 ELSE v::text END;
$$;
REVOKE ALL ON FUNCTION private.activity_history_canonical_json(jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION private.activity_history_scope_allowed(s jsonb, actor uuid) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF actor IS NULL OR jsonb_typeof(s) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
 IF (SELECT count(*) FROM jsonb_object_keys(s))<>10
 OR NOT s ?& ARRAY['userId','householdId','personIds','timezone','start','endExclusive','cutoffDate','contract','method','schema']
 OR s->>'userId' IS DISTINCT FROM actor::text OR s->'schema' IS DISTINCT FROM '1'::jsonb
 OR s->>'method' IS DISTINCT FROM 'canonical-activity-projection@snap1-v1'
 OR jsonb_typeof(s->'personIds') IS DISTINCT FROM 'array'
 OR EXISTS(SELECT 1 FROM jsonb_each(s) WHERE key<>'personIds' AND key<>'schema' AND jsonb_typeof(value)<>'string')
 OR coalesce(s->>'contract','')=''
 OR coalesce(s->>'start','')!~'^\d{4}-\d{2}-\d{2}$'
 OR coalesce(s->>'endExclusive','')!~'^\d{4}-\d{2}-\d{2}$'
 OR coalesce(s->>'cutoffDate','')!~'^\d{4}-\d{2}-\d{2}$'
 OR s->>'start'>=s->>'endExclusive' THEN RETURN false; END IF;
 -- Casts validate calendar dates; invalid caller input fails closed.
 PERFORM (s->>'start')::date,(s->>'endExclusive')::date,(s->>'cutoffDate')::date;
 RETURN EXISTS(SELECT 1 FROM auth.users u JOIN private.household_memberships m ON m.user_id=u.id
   JOIN public.households h ON h.household_id=m.household_id
   WHERE u.id=actor AND m.household_id=(s->>'householdId')::uuid AND u.deleted_at IS NULL
   AND (u.banned_until IS NULL OR u.banned_until<=now()) AND h.timezone=s->>'timezone')
 AND (SELECT coalesce(jsonb_agg(person_id::text ORDER BY person_id::text),'[]'::jsonb) FROM public.persons WHERE household_id=(s->>'householdId')::uuid)=s->'personIds'
 AND (SELECT count(*)=1 AND bool_and(status='READY' AND household_id=(s->>'householdId')::uuid AND household_count=1)
      FROM public.canonical_household_scope_control);
END $$;
REVOKE ALL ON FUNCTION private.activity_history_scope_allowed(jsonb,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION private.activity_history_writer_coverage() RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT (SELECT writer_signature=md5(pg_get_functiondef('private.bump_planner_activity_history()'::regprocedure))
         FROM private.planner_activity_history_state WHERE singleton)
 AND (SELECT count(*)=7 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE t.tgname='snap2_activity_history_version' AND t.tgenabled='A' AND t.tgtype=60
      AND NOT t.tgisinternal AND t.tgnargs=0 AND t.tgqual IS NULL
      AND t.tgfoid='private.bump_planner_activity_history()'::regprocedure
      AND (n.nspname='public' AND c.relname=ANY(ARRAY['life_events','life_event_types','life_event_participations','life_event_financial_links','households','persons'])
        OR n.nspname='private' AND c.relname='household_memberships'));
$$;
REVOKE ALL ON FUNCTION private.activity_history_writer_coverage() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION private.activity_history_proof(r bigint) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT jsonb_build_object('coverage','canonical-activity-transactional-triggers@v2','revisions',jsonb_build_object(
 'life_events',r::text,'life_event_types',r::text,'life_event_participations',r::text,'life_event_financial_links',r::text,'authorization_scope',r::text));
$$;
REVOKE ALL ON FUNCTION private.activity_history_proof(bigint) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.inspect_planner_activity_history_v1(p_scope jsonb,p_key text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE st private.planner_activity_history_state%ROWTYPE; a private.planner_activity_history_artifacts%ROWTYPE;
BEGIN
 IF private.activity_history_scope_allowed(p_scope,(SELECT auth.uid())) IS NOT TRUE
 OR private.user_has_household_access((p_scope->>'householdId')::uuid) IS NOT TRUE
 OR p_key IS DISTINCT FROM encode(sha256(convert_to(private.activity_history_canonical_json(p_scope),'UTF8')),'hex') THEN
  RAISE EXCEPTION 'SNAP2_PERMISSION_OR_SCOPE_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT st FROM private.planner_activity_history_state WHERE singleton;
 IF NOT st.enabled OR NOT private.activity_history_writer_coverage() THEN
  RETURN jsonb_build_object('proof',NULL,'generation',0,'artifact',NULL); END IF;
 SELECT * INTO a FROM private.planner_activity_history_artifacts WHERE scope_key=p_key;
 IF FOUND AND (a.owner_user_id<>(SELECT auth.uid()) OR a.household_id<>(p_scope->>'householdId')::uuid) THEN
  RAISE EXCEPTION 'SNAP2_ARTIFACT_SCOPE_CORRUPT'; END IF;
 RETURN jsonb_build_object('proof',private.activity_history_proof(st.revision),'generation',coalesce(a.generation,0),'artifact',a.artifact);
END $$;
REVOKE ALL ON FUNCTION public.inspect_planner_activity_history_v1(jsonb,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.inspect_planner_activity_history_v1(jsonb,text) TO authenticated;

CREATE FUNCTION public.publish_planner_activity_history_v1(p_scope jsonb,p_key text,p_expected_generation bigint,p_artifact jsonb)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE st private.planner_activity_history_state%ROWTYPE; g bigint;
BEGIN
 SET LOCAL lock_timeout='2s';
 IF private.activity_history_scope_allowed(p_scope,(p_scope->>'userId')::uuid) IS NOT TRUE
 OR p_key IS DISTINCT FROM encode(sha256(convert_to(private.activity_history_canonical_json(p_scope),'UTF8')),'hex') THEN
  RAISE EXCEPTION 'SNAP2_PUBLISH_SCOPE_DENIED' USING ERRCODE='42501'; END IF;
 IF p_expected_generation IS NULL OR p_expected_generation<0 OR p_expected_generation>=9007199254740991
 OR jsonb_typeof(p_artifact) IS DISTINCT FROM 'object' THEN
  RAISE EXCEPTION 'SNAP2_PUBLISH_PAYLOAD_INVALID' USING ERRCODE='23514'; END IF;
 IF (SELECT count(*) FROM jsonb_object_keys(p_artifact))<>8
 OR NOT p_artifact ?& ARRAY['scope','proof','generation','status','coverage','provenance','payload','digest']
 OR p_artifact->'scope' IS DISTINCT FROM p_scope OR p_artifact->>'status' IS DISTINCT FROM 'READY' OR p_artifact->>'coverage' IS DISTINCT FROM 'COMPLETE_SOURCE_ROWS'
 OR p_artifact->'provenance' IS DISTINCT FROM '["life_events","life_event_types","life_event_participations","life_event_financial_links"]'::jsonb
 OR p_artifact->>'digest' IS DISTINCT FROM encode(sha256(convert_to(private.activity_history_canonical_json(p_artifact-'digest'),'UTF8')),'hex') THEN
  RAISE EXCEPTION 'SNAP2_PUBLISH_PAYLOAD_INVALID' USING ERRCODE='23514'; END IF;
 -- Hashing the complete envelope is CPU work; do it before holding the version
 -- lock shared with source writers. Fresh scope/proof/CAS are checked below.
 SELECT * INTO STRICT st FROM private.planner_activity_history_state WHERE singleton FOR UPDATE;
 IF NOT st.enabled OR NOT private.activity_history_writer_coverage() THEN RETURN false; END IF;
 IF private.activity_history_scope_allowed(p_scope,(p_scope->>'userId')::uuid) IS NOT TRUE THEN
  RAISE EXCEPTION 'SNAP2_PUBLISH_SCOPE_DENIED' USING ERRCODE='42501'; END IF;
 IF p_artifact->'proof' IS DISTINCT FROM private.activity_history_proof(st.revision) THEN RETURN false; END IF;
 SELECT generation INTO g FROM private.planner_activity_history_artifacts WHERE scope_key=p_key;
 IF coalesce(g,0) IS DISTINCT FROM p_expected_generation
 OR p_artifact->'generation' IS DISTINCT FROM to_jsonb(p_expected_generation+1) THEN RETURN false; END IF;
 INSERT INTO private.planner_activity_history_artifacts(scope_key,owner_user_id,household_id,generation,artifact)
 VALUES(p_key,(p_scope->>'userId')::uuid,(p_scope->>'householdId')::uuid,p_expected_generation+1,p_artifact)
 ON CONFLICT(scope_key) DO UPDATE SET generation=excluded.generation,artifact=excluded.artifact,published_at=now();
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.publish_planner_activity_history_v1(jsonb,text,bigint,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.publish_planner_activity_history_v1(jsonb,text,bigint,jsonb) TO service_role;
-- Intentionally disabled. Activation requires separate schema/RLS/writer review.
COMMIT;
