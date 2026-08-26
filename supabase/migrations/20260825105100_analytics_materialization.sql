begin;

create table public.analytics_publications (
  publication_id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (household_id) on delete cascade,
  scope_kind text not null check (scope_kind in ('month', 'global')),
  period_month date,
  as_of_month date,
  source_revision bigint not null check (source_revision >= 0),
  base_analytics_revision bigint not null check (base_analytics_revision >= 0),
  published_analytics_revision bigint check (published_analytics_revision >= 0),
  required_artifact_keys text[] not null default '{}',
  required_query_keys text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published', 'failed')),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  constraint analytics_publications_period_shape check (
    (scope_kind = 'month' and period_month is not null and as_of_month is null)
    or (scope_kind = 'global' and period_month is null and as_of_month is not null)
  ),
  constraint analytics_publications_month_start check (
    (period_month is null or period_month = date_trunc('month', period_month::timestamp)::date)
    and (as_of_month is null or as_of_month = date_trunc('month', as_of_month::timestamp)::date)
  )
);

create table public.analytics_artifacts (
  artifact_row_id bigint generated always as identity primary key,
  artifact_key text not null,
  generation_key text not null default 'read_through',
  household_id uuid not null references public.households (household_id) on delete cascade,
  subject_kind text not null check (subject_kind in ('household', 'person')),
  subject_id uuid references public.persons (person_id) on delete cascade,
  period_kind text not null check (period_kind in ('month', 'global')),
  period_month date,
  as_of_month date,
  artifact_family text not null,
  metric_id text not null,
  dimension_key text,
  bucket_key text,
  scope_hash text not null check (scope_hash ~ '^[0-9a-f]{64}$'),
  filter_signature text not null check (filter_signature ~ '^[0-9a-f]{64}$'),
  method_version text not null,
  contract_version text not null,
  source_revision bigint not null check (source_revision >= 0),
  analytics_revision bigint not null check (analytics_revision >= 0),
  payload jsonb not null,
  computed_at timestamptz not null,
  publication_id uuid references public.analytics_publications (publication_id) on delete cascade,
  is_active boolean not null default true,
  invalidated_at timestamptz,
  invalidation_revision bigint check (invalidation_revision >= 0),
  constraint analytics_artifacts_subject_shape check (
    (subject_kind = 'household' and subject_id is null)
    or (subject_kind = 'person' and subject_id is not null)
  ),
  constraint analytics_artifacts_period_shape check (
    (period_kind = 'month' and period_month is not null and as_of_month is null)
    or (period_kind = 'global' and period_month is null and as_of_month is not null)
  ),
  constraint analytics_artifacts_month_start check (
    (period_month is null or period_month = date_trunc('month', period_month::timestamp)::date)
    and (as_of_month is null or as_of_month = date_trunc('month', as_of_month::timestamp)::date)
  ),
  constraint analytics_artifacts_invalidation_shape check (
    (invalidated_at is null and invalidation_revision is null)
    or (invalidated_at is not null and invalidation_revision is not null)
  ),
  constraint analytics_artifacts_version_unique unique (
    artifact_key,
    source_revision,
    method_version,
    contract_version,
    generation_key
  )
);

create table public.analytics_query_snapshots (
  query_snapshot_id bigint generated always as identity primary key,
  query_key text not null,
  generation_key text not null default 'read_through',
  household_id uuid not null references public.households (household_id) on delete cascade,
  resource text not null,
  scope_hash text not null check (scope_hash ~ '^[0-9a-f]{64}$'),
  normalized_param_signature text not null check (normalized_param_signature ~ '^[0-9a-f]{64}$'),
  subject_kind text not null check (subject_kind in ('household', 'person')),
  subject_id uuid references public.persons (person_id) on delete cascade,
  period_kind text not null check (period_kind in ('month', 'global')),
  period_month date,
  as_of_month date,
  source_revision bigint not null check (source_revision >= 0),
  analytics_revision bigint not null check (analytics_revision >= 0),
  contract_version text not null,
  method_signature text not null check (method_signature ~ '^[0-9a-f]{64}$'),
  payload jsonb not null,
  computed_at timestamptz not null,
  expires_at timestamptz,
  publication_id uuid references public.analytics_publications (publication_id) on delete cascade,
  is_active boolean not null default true,
  invalidated_at timestamptz,
  invalidation_revision bigint check (invalidation_revision >= 0),
  constraint analytics_query_snapshots_subject_shape check (
    (subject_kind = 'household' and subject_id is null)
    or (subject_kind = 'person' and subject_id is not null)
  ),
  constraint analytics_query_snapshots_period_shape check (
    (period_kind = 'month' and period_month is not null and as_of_month is null)
    or (period_kind = 'global' and period_month is null and as_of_month is not null)
  ),
  constraint analytics_query_snapshots_month_start check (
    (period_month is null or period_month = date_trunc('month', period_month::timestamp)::date)
    and (as_of_month is null or as_of_month = date_trunc('month', as_of_month::timestamp)::date)
  ),
  constraint analytics_query_snapshots_invalidation_shape check (
    (invalidated_at is null and invalidation_revision is null)
    or (invalidated_at is not null and invalidation_revision is not null)
  ),
  constraint analytics_query_snapshots_version_unique unique (
    query_key,
    source_revision,
    contract_version,
    method_signature,
    generation_key
  )
);

create index analytics_publications_household_status_idx
  on public.analytics_publications (household_id, status, created_at desc);
create index analytics_artifacts_household_month_idx
  on public.analytics_artifacts (household_id, period_month, metric_id)
  where is_active and invalidated_at is null;
create index analytics_artifacts_household_family_idx
  on public.analytics_artifacts (household_id, artifact_family, period_kind)
  where is_active and invalidated_at is null;
create index analytics_artifacts_scope_idx
  on public.analytics_artifacts (household_id, scope_hash, metric_id)
  where is_active and invalidated_at is null;
create index analytics_artifacts_metric_freshness_idx
  on public.analytics_artifacts (household_id, metric_id, source_revision desc)
  where is_active and invalidated_at is null;
create index analytics_artifacts_publication_idx
  on public.analytics_artifacts (publication_id)
  where publication_id is not null;
create index analytics_artifacts_subject_idx
  on public.analytics_artifacts (subject_id)
  where subject_id is not null;
create index analytics_query_snapshots_household_month_idx
  on public.analytics_query_snapshots (household_id, period_month, resource)
  where is_active and invalidated_at is null;
create index analytics_query_snapshots_lookup_idx
  on public.analytics_query_snapshots (household_id, query_key, source_revision desc)
  where is_active and invalidated_at is null;
create index analytics_query_snapshots_resource_idx
  on public.analytics_query_snapshots (household_id, resource, period_kind)
  where is_active and invalidated_at is null;
create index analytics_query_snapshots_publication_idx
  on public.analytics_query_snapshots (publication_id)
  where publication_id is not null;
create index analytics_query_snapshots_subject_idx
  on public.analytics_query_snapshots (subject_id)
  where subject_id is not null;
create index analytics_change_log_month_revision_idx
  on public.analytics_change_log (household_id, affected_month, data_revision desc)
  where affected_month is not null;
create index analytics_change_log_scope_revision_idx
  on public.analytics_change_log (household_id, impact_scope, data_revision desc);

alter table public.analytics_publications enable row level security;
alter table public.analytics_artifacts enable row level security;
alter table public.analytics_query_snapshots enable row level security;

revoke all on table public.analytics_publications from anon, authenticated;
revoke all on table public.analytics_artifacts from anon, authenticated;
revoke all on table public.analytics_query_snapshots from anon, authenticated;
grant select on table public.analytics_artifacts to authenticated;
grant select on table public.analytics_query_snapshots to authenticated;
grant all on table public.analytics_publications to service_role;
grant all on table public.analytics_artifacts to service_role;
grant all on table public.analytics_query_snapshots to service_role;
grant usage, select on sequence public.analytics_artifacts_artifact_row_id_seq to service_role;
grant usage, select on sequence public.analytics_query_snapshots_query_snapshot_id_seq to service_role;

create policy analytics_artifacts_select_household_member
  on public.analytics_artifacts
  for select
  to authenticated
  using ((select private.user_has_household_access(household_id)));

create policy analytics_query_snapshots_select_household_member
  on public.analytics_query_snapshots
  for select
  to authenticated
  using ((select private.user_has_household_access(household_id)));

create or replace function private.invalidate_analytics_materialization(
  p_household_id uuid,
  p_data_revision bigint,
  p_affected_month date,
  p_impact_scope text,
  p_query_resources text[]
)
returns table(invalidated_artifact_count bigint, invalidated_query_count bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_artifacts bigint := 0;
  v_queries bigint := 0;
begin
  if p_impact_scope not in ('month', 'entity', 'global_reference', 'narrative') then
    raise exception 'Invalid impact_scope %', p_impact_scope using errcode = '23514';
  end if;

  update public.analytics_artifacts
     set invalidated_at = now(),
         invalidation_revision = p_data_revision
   where household_id = p_household_id
     and is_active
     and invalidated_at is null
     and (
       (p_impact_scope = 'month' and period_month = p_affected_month)
       or (
         p_impact_scope = 'global_reference'
         and (
           period_kind = 'global'
           or (
             metric_id in ('typical_month_cost', 'minimal_month_cost')
             and (p_affected_month is null or period_month >= p_affected_month)
           )
         )
       )
       or (
         p_impact_scope = 'entity'
         and (p_affected_month is null or period_month = p_affected_month)
       )
       or (p_impact_scope = 'narrative' and artifact_family = 'narrative')
     );
  get diagnostics v_artifacts = row_count;

  update public.analytics_query_snapshots
     set invalidated_at = now(),
         invalidation_revision = p_data_revision
   where household_id = p_household_id
     and is_active
     and invalidated_at is null
     and (
       (
         resource = any(coalesce(p_query_resources, '{}'))
         and (
           (p_impact_scope = 'month' and period_month = p_affected_month)
           or (
             p_impact_scope = 'entity'
             and (p_affected_month is null or period_month = p_affected_month)
           )
           or p_impact_scope = 'narrative'
           or (
             p_impact_scope = 'global_reference'
             and (
               period_kind = 'global'
               or p_affected_month is null
               or period_month >= p_affected_month
             )
           )
         )
       )
     );
  get diagnostics v_queries = row_count;

  return query select v_artifacts, v_queries;
end;
$$;

create or replace function public.record_analytics_mutation(
  p_household_id uuid,
  p_entity_kind text,
  p_entity_id uuid,
  p_affected_month date,
  p_impact_scope text,
  p_query_resources text[],
  p_invalidate_global_reference boolean default false
)
returns table(data_revision bigint, change_id uuid, invalidated_artifact_count bigint, invalidated_query_count bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revision bigint;
  v_change_id uuid;
  v_artifacts bigint;
  v_queries bigint;
  v_global_artifacts bigint;
  v_global_queries bigint;
begin
  select bumped.data_revision, bumped.change_id
    into v_revision, v_change_id
    from private.bump_revision_and_log(
      p_household_id,
      p_entity_kind,
      p_entity_id,
      p_affected_month,
      p_impact_scope
    ) as bumped;

  select invalidated.invalidated_artifact_count, invalidated.invalidated_query_count
    into v_artifacts, v_queries
    from private.invalidate_analytics_materialization(
      p_household_id,
      v_revision,
      p_affected_month,
      p_impact_scope,
      p_query_resources
    ) as invalidated;

  if p_invalidate_global_reference and p_impact_scope <> 'global_reference' then
    select invalidated.invalidated_artifact_count, invalidated.invalidated_query_count
      into v_global_artifacts, v_global_queries
      from private.invalidate_analytics_materialization(
        p_household_id,
        v_revision,
        p_affected_month,
        'global_reference',
        p_query_resources
      ) as invalidated;
    v_artifacts := v_artifacts + v_global_artifacts;
    v_queries := v_queries + v_global_queries;
  end if;

  return query select v_revision, v_change_id, v_artifacts, v_queries;
end;
$$;

create or replace function public.publish_analytics_materialization(
  p_publication_id uuid,
  p_expected_analytics_revision bigint
)
returns table(analytics_revision bigint, source_revision bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_publication public.analytics_publications%rowtype;
  v_current_data_revision bigint;
  v_current_analytics_revision bigint;
  v_next_analytics_revision bigint;
  v_artifact_count bigint;
  v_query_count bigint;
begin
  select *
    into v_publication
    from public.analytics_publications
   where publication_id = p_publication_id
   for update;

  if v_publication.publication_id is null then
    raise exception 'Unknown analytics publication %', p_publication_id using errcode = '23503';
  end if;
  if v_publication.status = 'published' then
    return query select v_publication.published_analytics_revision, v_publication.source_revision;
    return;
  end if;
  if v_publication.status <> 'draft' then
    raise exception 'Analytics publication % is not publishable', p_publication_id using errcode = '23514';
  end if;

  select hr.data_revision, hr.analytics_revision
    into v_current_data_revision, v_current_analytics_revision
    from public.household_revisions hr
   where hr.household_id = v_publication.household_id
   for update;

  if v_current_analytics_revision is distinct from p_expected_analytics_revision
     or v_current_analytics_revision is distinct from v_publication.base_analytics_revision then
    raise exception 'Concurrent analytics revision' using errcode = '40001';
  end if;
  if v_publication.source_revision > v_current_data_revision then
    raise exception 'Cannot publish future source revision' using errcode = '23514';
  end if;

  select count(distinct artifact_key)
    into v_artifact_count
    from public.analytics_artifacts
   where publication_id = p_publication_id
     and artifact_key = any(v_publication.required_artifact_keys)
     and invalidated_at is null;
  select count(distinct query_key)
    into v_query_count
    from public.analytics_query_snapshots
   where publication_id = p_publication_id
     and query_key = any(v_publication.required_query_keys)
     and invalidated_at is null;

  if v_artifact_count <> cardinality(v_publication.required_artifact_keys)
     or v_query_count <> cardinality(v_publication.required_query_keys) then
    raise exception 'Analytics publication is incomplete' using errcode = '23514';
  end if;

  update public.analytics_artifacts old
     set is_active = false
   where old.household_id = v_publication.household_id
     and old.is_active
     and old.publication_id is distinct from p_publication_id
     and exists (
       select 1 from public.analytics_artifacts fresh
       where fresh.publication_id = p_publication_id
         and fresh.artifact_key = old.artifact_key
     );
  update public.analytics_query_snapshots old
     set is_active = false
   where old.household_id = v_publication.household_id
     and old.is_active
     and old.publication_id is distinct from p_publication_id
     and exists (
       select 1 from public.analytics_query_snapshots fresh
       where fresh.publication_id = p_publication_id
         and fresh.query_key = old.query_key
     );
  update public.analytics_artifacts set is_active = true where publication_id = p_publication_id;
  update public.analytics_query_snapshots set is_active = true where publication_id = p_publication_id;

  v_next_analytics_revision := v_current_analytics_revision + 1;
  update public.household_revisions
     set analytics_revision = v_next_analytics_revision,
         updated_at = now()
   where household_id = v_publication.household_id;

  if v_publication.scope_kind = 'month' then
    update public.analysis_periods
       set source_revision = v_publication.source_revision,
           updated_at = now()
     where household_id = v_publication.household_id
       and month = v_publication.period_month;
    update public.analytics_change_log
       set processed_at = now()
     where household_id = v_publication.household_id
       and affected_month = v_publication.period_month
       and data_revision <= v_publication.source_revision
       and processed_at is null;
  else
    update public.analytics_change_log
       set processed_at = now()
     where household_id = v_publication.household_id
       and impact_scope = 'global_reference'
       and data_revision <= v_publication.source_revision
       and processed_at is null;
  end if;

  update public.analytics_publications
     set status = 'published',
         published_analytics_revision = v_next_analytics_revision,
         published_at = now()
   where publication_id = p_publication_id;

  return query select v_next_analytics_revision, v_publication.source_revision;
end;
$$;

revoke all on function private.invalidate_analytics_materialization(uuid, bigint, date, text, text[]) from public, anon, authenticated;
revoke all on function public.record_analytics_mutation(uuid, text, uuid, date, text, text[], boolean) from public, anon, authenticated;
revoke all on function public.publish_analytics_materialization(uuid, bigint) from public, anon, authenticated;
grant execute on function public.record_analytics_mutation(uuid, text, uuid, date, text, text[], boolean) to service_role;
grant execute on function public.publish_analytics_materialization(uuid, bigint) to service_role;

commit;
