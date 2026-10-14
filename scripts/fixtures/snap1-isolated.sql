-- Executable fixture ONLY. Not a Supabase migration. No production schema/role grants.
-- JSON rows mirror exactly the selected Canonical sources, not a new financial model.
CREATE SCHEMA snap1_isolated;
CREATE TABLE snap1_isolated.versions (dependency text PRIMARY KEY, revision bigint NOT NULL DEFAULT 0);
INSERT INTO snap1_isolated.versions(dependency) VALUES
 ('life_events'),('life_event_types'),('life_event_participations'),('life_event_financial_links'),('authorization_scope');
CREATE TABLE snap1_isolated.life_events (row_key text PRIMARY KEY, payload jsonb NOT NULL);
CREATE TABLE snap1_isolated.life_event_types (row_key text PRIMARY KEY, payload jsonb NOT NULL);
CREATE TABLE snap1_isolated.life_event_participations (row_key text PRIMARY KEY, payload jsonb NOT NULL);
CREATE TABLE snap1_isolated.life_event_financial_links (row_key text PRIMARY KEY, payload jsonb NOT NULL);
CREATE TABLE snap1_isolated.households (id text PRIMARY KEY, timezone text NOT NULL, canonical boolean NOT NULL DEFAULT false);
CREATE TABLE snap1_isolated.persons (id text PRIMARY KEY, household_id text NOT NULL REFERENCES snap1_isolated.households(id));
CREATE TABLE snap1_isolated.memberships (user_id text NOT NULL, household_id text NOT NULL REFERENCES snap1_isolated.households(id),
 active boolean NOT NULL DEFAULT true, PRIMARY KEY(user_id,household_id));
CREATE TABLE snap1_isolated.artifacts (scope_key text PRIMARY KEY, generation bigint NOT NULL CHECK(generation>0), artifact jsonb NOT NULL);
CREATE FUNCTION snap1_isolated.bump_version() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
 SET search_path = pg_catalog, snap1_isolated AS $$
BEGIN
 UPDATE snap1_isolated.versions SET revision=revision+1 WHERE dependency=TG_ARGV[0];
 IF NOT FOUND THEN RAISE EXCEPTION 'SNAP1_DEPENDENCY_MISSING'; END IF;
 RETURN NULL;
END $$;
-- Statement triggers also cover raw SQL, imports, retroactive writes, deletes and TRUNCATE.
-- ENABLE ALWAYS proves coverage under replica/service/admin ordinary DML in this fixture.
-- DDL additionally fences every generation, including disable/re-enable of triggers.
DO $$ DECLARE owner_table text; BEGIN
 FOREACH owner_table IN ARRAY ARRAY['life_events','life_event_types','life_event_participations','life_event_financial_links','households','persons','memberships'] LOOP
  EXECUTE format('CREATE TRIGGER snap1_version AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON snap1_isolated.%I
   FOR EACH STATEMENT EXECUTE FUNCTION snap1_isolated.bump_version(%L)',owner_table,
   CASE WHEN owner_table IN ('households','persons','memberships') THEN 'authorization_scope' ELSE owner_table END);
  EXECUTE format('ALTER TABLE snap1_isolated.%I ENABLE ALWAYS TRIGGER snap1_version',owner_table);
 END LOOP;
END $$;
CREATE FUNCTION snap1_isolated.invalidate_ddl() RETURNS event_trigger LANGUAGE plpgsql SECURITY INVOKER
 SET search_path = pg_catalog, snap1_isolated AS $$
BEGIN
 UPDATE snap1_isolated.versions SET revision=revision+1 WHERE dependency='authorization_scope';
 IF NOT FOUND THEN RAISE EXCEPTION 'SNAP1_DEPENDENCY_MISSING'; END IF;
END $$;
CREATE EVENT TRIGGER snap1_ddl_version ON ddl_command_end EXECUTE FUNCTION snap1_isolated.invalidate_ddl();
ALTER EVENT TRIGGER snap1_ddl_version ENABLE ALWAYS;
REVOKE ALL ON SCHEMA snap1_isolated FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA snap1_isolated FROM PUBLIC;
REVOKE ALL ON FUNCTION snap1_isolated.bump_version() FROM PUBLIC;
REVOKE ALL ON FUNCTION snap1_isolated.invalidate_ddl() FROM PUBLIC;
