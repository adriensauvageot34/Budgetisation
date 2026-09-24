-- Fix the qualified revision lookup in the M1-H1M transactional backfill.
-- The return column `data_revision` is also a PL/pgSQL variable, so every
-- household_revisions column reference must be qualified.
begin;

create or replace function public.apply_m1_historical_minimal_authority_backfill(
  p_household_id uuid,
  p_expected_data_revision bigint,
  p_plan_hash text,
  p_rule_versions jsonb,
  p_recurrence_state_versions jsonb
)
returns table(
  data_revision bigint,
  rule_versions bigint,
  recurrence_state_versions bigint,
  invalidated_artifacts bigint,
  invalidated_queries bigint,
  idempotent_retry boolean
)
language plpgsql security definer set search_path = '' as $$
declare
  v_current_revision bigint;
  v_existing_rules bigint;
  v_existing_recurrences bigint;
  v_mutation record;
  v_query_resources text[];
begin
  if p_plan_hash !~ '^[0-9a-f]{64}$'
     or pg_catalog.jsonb_typeof(p_rule_versions) is distinct from 'array'
     or pg_catalog.jsonb_typeof(p_recurrence_state_versions) is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_rule_versions) <> 34
     or pg_catalog.jsonb_array_length(p_recurrence_state_versions) <> 15 then
    raise exception 'Invalid M1-H1M backfill payload' using errcode = '23514';
  end if;

  select r.data_revision into v_current_revision
    from public.household_revisions r
    where r.household_id = p_household_id
    for update;
  if not found then raise exception 'Unknown Household revision' using errcode = '23503'; end if;

  select count(*) into v_existing_rules from public.minimal_baseline_rule_versions
    where household_id = p_household_id and backfill_plan_hash = p_plan_hash;
  select count(*) into v_existing_recurrences from public.recurrence_state_history
    where household_id = p_household_id and backfill_plan_hash = p_plan_hash;
  if v_existing_rules <> 0 or v_existing_recurrences <> 0 then
    if v_existing_rules <> 34 or v_existing_recurrences <> 15 then
      raise exception 'Partial M1-H1M backfill detected' using errcode = '23514';
    end if;
    return query select
      (select max(source_revision) from public.minimal_baseline_rule_versions where household_id = p_household_id and backfill_plan_hash = p_plan_hash),
      v_existing_rules, v_existing_recurrences, 0::bigint, 0::bigint, true;
    return;
  end if;

  if v_current_revision is distinct from p_expected_data_revision then
    raise exception 'Canonical revision drift before M1-H1M backfill' using errcode = '40001';
  end if;

  insert into public.minimal_baseline_rule_versions (
    rule_version_id, household_id, baseline_rule_id, master_rule_family, condition_code,
    effective_from, effective_to, declared_at, source_revision, authority_type,
    declared_by_ref, validation_ref, method_version, evidence_refs, supersedes_version_id,
    backfill_plan_hash
  )
  select r.rule_version_id, p_household_id, r.baseline_rule_id, r.master_rule_family, r.condition_code,
    r.effective_from, r.effective_to, r.declared_at, r.source_revision, r.authority_type,
    r.declared_by_ref, r.validation_ref, r.method_version, r.evidence_refs, r.supersedes_version_id,
    p_plan_hash
  from pg_catalog.jsonb_to_recordset(p_rule_versions) as r(
    rule_version_id uuid, baseline_rule_id uuid, master_rule_family text, condition_code text,
    effective_from date, effective_to date, declared_at timestamptz, source_revision bigint,
    authority_type text, declared_by_ref text, validation_ref text, method_version text,
    evidence_refs jsonb, supersedes_version_id uuid
  );

  insert into public.recurrence_state_history (
    state_version_id, household_id, recurrence_series_id, historical_state,
    effective_from, effective_to, declared_at, source_revision, authority_type,
    declared_by_ref, validation_ref, method_version, evidence_refs, supersedes_version_id,
    backfill_plan_hash
  )
  select r.state_version_id, p_household_id, r.recurrence_series_id, r.historical_state,
    r.effective_from, r.effective_to, r.declared_at, r.source_revision, r.authority_type,
    r.declared_by_ref, r.validation_ref, r.method_version, r.evidence_refs, r.supersedes_version_id,
    p_plan_hash
  from pg_catalog.jsonb_to_recordset(p_recurrence_state_versions) as r(
    state_version_id uuid, recurrence_series_id uuid, historical_state text,
    effective_from date, effective_to date, declared_at timestamptz, source_revision bigint,
    authority_type text, declared_by_ref text, validation_ref text, method_version text,
    evidence_refs jsonb, supersedes_version_id uuid
  );

  select pg_catalog.array_agg(distinct resource order by resource) into v_query_resources
    from public.analytics_query_snapshots
    where household_id = p_household_id and is_active and invalidated_at is null
      and (period_kind = 'global' or resource in ('history_month_balance_summary', 'history_minimal_preview'));

  select * into v_mutation from public.record_analytics_mutation(
    p_household_id,
    'minimal_historical_authority_backfill',
    (select min(rule_version_id) from public.minimal_baseline_rule_versions where household_id = p_household_id and backfill_plan_hash = p_plan_hash),
    date '2025-08-01',
    'global_reference',
    coalesce(v_query_resources, '{}'::text[]),
    false
  );
  if v_mutation.data_revision <> p_expected_data_revision + 1 then
    raise exception 'Unexpected M1-H1M source revision' using errcode = '40001';
  end if;
  if exists (
    select 1 from public.minimal_baseline_rule_versions
    where household_id = p_household_id and backfill_plan_hash = p_plan_hash
      and source_revision <> v_mutation.data_revision
  ) or exists (
    select 1 from public.recurrence_state_history
    where household_id = p_household_id and backfill_plan_hash = p_plan_hash
      and source_revision <> v_mutation.data_revision
  ) then
    raise exception 'M1-H1M version/source revision mismatch' using errcode = '23514';
  end if;

  return query select v_mutation.data_revision, 34::bigint, 15::bigint,
    v_mutation.invalidated_artifact_count, v_mutation.invalidated_query_count, false;
end;
$$;

revoke all on function public.apply_m1_historical_minimal_authority_backfill(uuid, bigint, text, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_m1_historical_minimal_authority_backfill(uuid, bigint, text, jsonb, jsonb)
  to service_role;

commit;
