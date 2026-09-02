begin;

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
       select 1
         from public.analytics_artifacts fresh
        where fresh.publication_id = p_publication_id
          and fresh.household_id = old.household_id
          and fresh.artifact_family = old.artifact_family
          and fresh.metric_id is not distinct from old.metric_id
          and fresh.dimension_key is not distinct from old.dimension_key
          and fresh.bucket_key is not distinct from old.bucket_key
          and fresh.scope_hash = old.scope_hash
          and fresh.filter_signature = old.filter_signature
          and fresh.subject_kind = old.subject_kind
          and fresh.subject_id is not distinct from old.subject_id
          and fresh.period_kind = old.period_kind
          and fresh.period_month is not distinct from old.period_month
          and fresh.as_of_month is not distinct from old.as_of_month
          and fresh.contract_version = old.contract_version
     );
  update public.analytics_query_snapshots old
     set is_active = false
   where old.household_id = v_publication.household_id
     and old.is_active
     and old.publication_id is distinct from p_publication_id
     and exists (
       select 1
         from public.analytics_query_snapshots fresh
        where fresh.publication_id = p_publication_id
          and fresh.household_id = old.household_id
          and fresh.resource = old.resource
          and fresh.scope_hash = old.scope_hash
          and fresh.normalized_param_signature = old.normalized_param_signature
          and fresh.subject_kind = old.subject_kind
          and fresh.subject_id is not distinct from old.subject_id
          and fresh.period_kind = old.period_kind
          and fresh.period_month is not distinct from old.period_month
          and fresh.as_of_month is not distinct from old.as_of_month
          and fresh.contract_version = old.contract_version
     );
  update public.analytics_artifacts
     set is_active = true
   where publication_id = p_publication_id;
  update public.analytics_query_snapshots
     set is_active = true
   where publication_id = p_publication_id;

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

revoke all on function public.publish_analytics_materialization(uuid, bigint)
  from public, anon, authenticated;
grant execute on function public.publish_analytics_materialization(uuid, bigint)
  to service_role;

commit;
