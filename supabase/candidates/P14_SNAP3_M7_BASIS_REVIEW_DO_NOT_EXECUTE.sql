-- SNAP-3 tranche C. Extend the installed Canonical basis proof to M7 owners.
-- Candidate only: review and native PostgreSQL validation before remote DDL.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$ DECLARE e bigint; BEGIN
 IF current_user<>'postgres' OR to_regclass('private.composer_historical_basis_state') IS NULL
 OR to_regprocedure('private.composer_basis_writer_coverage()') IS NULL THEN RAISE EXCEPTION 'M7_BASIS_PRECONDITION'; END IF;
 SELECT schema_epoch INTO STRICT e FROM private.composer_historical_basis_state WHERE singleton;
 IF e<>1 OR private.composer_basis_writer_coverage() IS NOT TRUE THEN RAISE EXCEPTION 'M7_BASIS_PRECONDITION'; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='snap3_historical_basis_version'
   AND tgrelid=ANY(ARRAY['public.mobility_legs','public.person_days','public.location_occurrences',
     'public.life_events','public.life_event_types','public.life_event_participations',
     'public.life_event_localizations','public.life_event_financial_links']::regclass[]))
 THEN RAISE EXCEPTION 'M7_BASIS_ALREADY_INSTALLED'; END IF;
END $$;

CREATE OR REPLACE FUNCTION private.composer_basis_sources() RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT ARRAY['public.operations','public.operation_allocations','public.operation_items','public.payment_components',
 'public.cash_economic_uses','public.refund_allocations','public.economic_consumption_segments','public.operation_place_links',
 'public.financial_source_person_links','public.categories','public.subcategories','public.merchants',
 'public.purchase_events','public.purchase_event_memberships','public.purchase_event_timing_assertions',
 'public.purchase_economic_components','public.purchase_event_classification_assertions','public.economic_component_classifications',
 'public.households','public.persons','private.household_memberships','public.analysis_periods',
 'public.mobility_legs','public.person_days','public.location_occurrences','public.life_events',
 'public.life_event_types','public.life_event_participations','public.life_event_localizations','public.life_event_financial_links']::text[];
$$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['public.mobility_legs','public.person_days','public.location_occurrences',
   'public.life_events','public.life_event_types','public.life_event_participations',
   'public.life_event_localizations','public.life_event_financial_links'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=t::regclass AND relkind='r' AND NOT relispartition)
   THEN RAISE EXCEPTION 'M7_BASIS_SOURCE_PRECONDITION'; END IF;
  EXECUTE format('CREATE TRIGGER snap3_historical_basis_version AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON %s FOR EACH STATEMENT EXECUTE FUNCTION private.bump_composer_historical_basis()',t);
  EXECUTE format('ALTER TABLE %s ENABLE ALWAYS TRIGGER snap3_historical_basis_version',t);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION private.composer_basis_scope_allowed(s jsonb,actor uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT s->>'method' IN ('composer-canonical-basis@v1','composer-m7-basis@v1')
 AND s->>'cutoffDate'=s->>'endExclusive'
 AND private.activity_history_scope_allowed(jsonb_set(s,'{method}','"canonical-activity-projection@snap1-v1"'::jsonb),actor);
$$;
CREATE OR REPLACE FUNCTION private.composer_basis_proof(r bigint,e bigint) RETURNS jsonb
 LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT jsonb_build_object('coverage','composer-historical-writers@v2','revision',r::text,'schemaEpoch',e::text);
$$;
REVOKE ALL ON FUNCTION private.composer_basis_sources(),private.composer_basis_scope_allowed(jsonb,uuid),
 private.composer_basis_proof(bigint,bigint) FROM PUBLIC,anon,authenticated,service_role;
UPDATE private.composer_historical_basis_state SET schema_epoch=2 WHERE singleton;
DO $$ BEGIN
 IF private.composer_basis_writer_coverage() IS NOT TRUE THEN RAISE EXCEPTION 'M7_BASIS_COVERAGE_INVALID'; END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
