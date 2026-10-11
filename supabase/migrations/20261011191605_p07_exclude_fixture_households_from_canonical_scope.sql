-- CANDIDATE ONLY. Cross-owner Canonical view repair requires separate user approval.
-- No data rows are inserted, updated, or deleted.
-- Supabase apply_migration supplies the outer atomic transaction.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $guard$
DECLARE
  v_fixture_count bigint;
  v_real_count bigint;
  v_scope_count bigint;
  v_scope_status text;
BEGIN
  IF md5(pg_get_viewdef('public.canonical_household_scope_control'::regclass, true))
     <> 'c0e59662339fd40dc068f2cffc6f8b4b' THEN
    RAISE EXCEPTION 'CANONICAL_VIEW_DRIFT';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    WHERE c.oid = 'public.canonical_household_scope_control'::regclass
      AND pg_get_userbyid(c.relowner) = 'postgres'
      AND c.reloptions @> ARRAY['security_invoker=true']::text[]
  ) THEN
    RAISE EXCEPTION 'CANONICAL_VIEW_OWNER_OR_SECURITY_DRIFT';
  END IF;

  SELECT count(*) INTO v_fixture_count
  FROM public.households
  WHERE (household_id = 'f07b0000-0000-4000-8000-000000000001'::uuid
         AND name = 'P07B_TEST_H1_20261010')
     OR (household_id = 'f07b0000-0000-4000-8000-000000000002'::uuid
         AND name = 'P07B_TEST_H2_20261010');

  SELECT count(*) INTO v_real_count
  FROM public.households
  WHERE household_id NOT IN (
    'f07b0000-0000-4000-8000-000000000001'::uuid,
    'f07b0000-0000-4000-8000-000000000002'::uuid
  );

  SELECT household_count, status INTO v_scope_count, v_scope_status
  FROM public.canonical_household_scope_control;

  IF v_fixture_count <> 2 OR v_real_count <> 1
     OR v_scope_count <> 3 OR v_scope_status <> 'AMBIGUOUS' THEN
    RAISE EXCEPTION 'CANONICAL_SCOPE_PRECONDITION_FAILED';
  END IF;
END;
$guard$;

CREATE OR REPLACE VIEW public.canonical_household_scope_control
WITH (security_invoker = true) AS
SELECT count(*) AS household_count,
       CASE WHEN count(*) = 1 THEN min(household_id::text)::uuid
            ELSE NULL::uuid END AS household_id,
       CASE WHEN count(*) = 1 THEN 'READY'::text
            ELSE 'AMBIGUOUS'::text END AS status
FROM public.households
WHERE household_id NOT IN (
  'f07b0000-0000-4000-8000-000000000001'::uuid,
  'f07b0000-0000-4000-8000-000000000002'::uuid
);

DO $verify$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.canonical_household_scope_control scope
    WHERE scope.household_count = 1
      AND scope.status = 'READY'
      AND scope.household_id = (
        SELECT household_id FROM public.households
        WHERE household_id NOT IN (
          'f07b0000-0000-4000-8000-000000000001'::uuid,
          'f07b0000-0000-4000-8000-000000000002'::uuid
        )
      )
  ) THEN
    RAISE EXCEPTION 'CANONICAL_SCOPE_POSTCONDITION_FAILED';
  END IF;
END;
$verify$;

