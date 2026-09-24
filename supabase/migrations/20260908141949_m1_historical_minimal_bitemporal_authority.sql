-- M1-H1M: additive bitemporal authority for Historical Minimal.
-- Prepared only. Explicit LIVE_BACKFILL_AUTHORIZED = YES is required before apply.
begin;

create table public.minimal_baseline_rule_versions (
  rule_version_id uuid primary key,
  household_id uuid not null references public.households(household_id),
  baseline_rule_id uuid not null references public.minimal_baseline_rules(baseline_rule_id),
  master_rule_family text not null check (master_rule_family in (
    'FIXED_REQUIRED', 'PERIODIC_REQUIRED', 'VARIABLE_ESSENTIAL',
    'DECLARED_MINIMUM', 'EXCLUDED_FROM_MINIMAL'
  )),
  condition_code text,
  effective_from date not null,
  effective_to date,
  declared_at timestamptz not null,
  source_revision bigint not null check (source_revision > 0),
  authority_type text not null check (authority_type in (
    'OBSERVED_ECONOMIC_EVIDENCE', 'RETROSPECTIVE_DECLARATION',
    'DECLARED', 'CONTRACTUAL', 'ANALYTICS_DERIVED'
  )),
  declared_by_ref text not null check (btrim(declared_by_ref) <> ''),
  validation_ref text not null check (btrim(validation_ref) <> ''),
  method_version text not null check (btrim(method_version) <> ''),
  evidence_refs jsonb not null check (jsonb_typeof(evidence_refs) = 'array'),
  supersedes_version_id uuid references public.minimal_baseline_rule_versions(rule_version_id),
  backfill_plan_hash text not null check (backfill_plan_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  constraint minimal_rule_version_non_empty_interval
    check (effective_to is null or effective_to > effective_from),
  constraint minimal_rule_version_condition_authority
    check (
      master_rule_family <> 'VARIABLE_ESSENTIAL'
      or condition_code is null
      or btrim(condition_code) <> ''
    )
);

create table public.recurrence_state_history (
  state_version_id uuid primary key,
  household_id uuid not null references public.households(household_id),
  recurrence_series_id uuid not null references public.recurrence_series(recurrence_series_id),
  historical_state text not null check (historical_state in (
    'ACTIVE_FOR_MINIMAL', 'INACTIVE_FOR_MINIMAL'
  )),
  effective_from date not null,
  effective_to date,
  declared_at timestamptz not null,
  source_revision bigint not null check (source_revision > 0),
  authority_type text not null check (authority_type in (
    'OBSERVED_ECONOMIC_EVIDENCE', 'RETROSPECTIVE_DECLARATION',
    'DECLARED', 'CONTRACTUAL', 'ANALYTICS_DERIVED'
  )),
  declared_by_ref text not null check (btrim(declared_by_ref) <> ''),
  validation_ref text not null check (btrim(validation_ref) <> ''),
  method_version text not null check (btrim(method_version) <> ''),
  evidence_refs jsonb not null check (jsonb_typeof(evidence_refs) = 'array'),
  supersedes_version_id uuid references public.recurrence_state_history(state_version_id),
  backfill_plan_hash text not null check (backfill_plan_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  constraint recurrence_state_non_empty_interval
    check (effective_to is null or effective_to > effective_from)
);

create index minimal_rule_versions_effective_lookup
  on public.minimal_baseline_rule_versions
  (household_id, baseline_rule_id, effective_from, source_revision desc, declared_at desc);
create index recurrence_state_effective_lookup
  on public.recurrence_state_history
  (household_id, recurrence_series_id, effective_from, source_revision desc, declared_at desc);

create function public.guard_minimal_rule_version_history()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_superseded public.minimal_baseline_rule_versions%rowtype;
begin
  if tg_op <> 'INSERT' then
    raise exception 'Historical Minimal rule versions are append-only' using errcode = '23514';
  end if;
  if new.supersedes_version_id is not null then
    select * into v_superseded from public.minimal_baseline_rule_versions
      where rule_version_id = new.supersedes_version_id;
    if not found or v_superseded.household_id <> new.household_id
       or v_superseded.baseline_rule_id <> new.baseline_rule_id
       or v_superseded.source_revision >= new.source_revision then
      raise exception 'Invalid superseded Minimal rule version' using errcode = '23514';
    end if;
  end if;
  if exists (
    select 1 from public.minimal_baseline_rule_versions v
    where v.household_id = new.household_id
      and v.baseline_rule_id = new.baseline_rule_id
      and v.source_revision = new.source_revision
      and daterange(v.effective_from, v.effective_to, '[)') && daterange(new.effective_from, new.effective_to, '[)')
      and (v.master_rule_family, coalesce(v.condition_code, ''))
          is distinct from (new.master_rule_family, coalesce(new.condition_code, ''))
  ) then
    raise exception 'Contradictory Minimal rule versions overlap at the same source revision' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function public.guard_recurrence_state_history()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_superseded public.recurrence_state_history%rowtype;
begin
  if tg_op <> 'INSERT' then
    raise exception 'Historical recurrence states are append-only' using errcode = '23514';
  end if;
  if new.supersedes_version_id is not null then
    select * into v_superseded from public.recurrence_state_history
      where state_version_id = new.supersedes_version_id;
    if not found or v_superseded.household_id <> new.household_id
       or v_superseded.recurrence_series_id <> new.recurrence_series_id
       or v_superseded.source_revision >= new.source_revision then
      raise exception 'Invalid superseded recurrence state version' using errcode = '23514';
    end if;
  end if;
  if exists (
    select 1 from public.recurrence_state_history v
    where v.household_id = new.household_id
      and v.recurrence_series_id = new.recurrence_series_id
      and v.source_revision = new.source_revision
      and daterange(v.effective_from, v.effective_to, '[)') && daterange(new.effective_from, new.effective_to, '[)')
      and v.historical_state is distinct from new.historical_state
  ) then
    raise exception 'Contradictory recurrence states overlap at the same source revision' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger minimal_rule_version_history_guard
before insert or update or delete on public.minimal_baseline_rule_versions
for each row execute function public.guard_minimal_rule_version_history();

create trigger recurrence_state_history_guard
before insert or update or delete on public.recurrence_state_history
for each row execute function public.guard_recurrence_state_history();

create trigger minimal_rule_version_household_scope_guard
before insert on public.minimal_baseline_rule_versions
for each row execute function private.assert_history_v2_household_scope();

create trigger recurrence_state_household_scope_guard
before insert on public.recurrence_state_history
for each row execute function private.assert_history_v2_household_scope();

alter table public.minimal_baseline_rule_versions enable row level security;
alter table public.recurrence_state_history enable row level security;

revoke all on table public.minimal_baseline_rule_versions from public, anon, authenticated;
revoke all on table public.recurrence_state_history from public, anon, authenticated;
grant select on table public.minimal_baseline_rule_versions to service_role;
grant select on table public.recurrence_state_history to service_role;

revoke all on function public.guard_minimal_rule_version_history() from public, anon, authenticated;
revoke all on function public.guard_recurrence_state_history() from public, anon, authenticated;

create function public.apply_m1_historical_minimal_authority_backfill(
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

  select data_revision into v_current_revision
    from public.household_revisions where household_id = p_household_id for update;
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

comment on table public.minimal_baseline_rule_versions is
  'Append-only bitemporal Minimal rule authority. Identity remains in minimal_baseline_rules.';
comment on table public.recurrence_state_history is
  'Append-only bitemporal Minimal recurrence-state authority. Occurrences remain in Canonical sources.';

commit;
