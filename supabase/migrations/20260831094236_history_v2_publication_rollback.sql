begin;

create or replace function public.restore_history_v2_publication(
  p_current_publication_id uuid,
  p_target_publication_id uuid,
  p_household_id uuid,
  p_period_month date,
  p_expected_analytics_revision bigint
)
returns table(
  analytics_revision bigint,
  source_revision bigint,
  active_publication_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revision bigint;
  v_source_revision bigint;
  v_current_ids uuid[];
  v_target public.analytics_publications%rowtype;
  v_target_artifact_count bigint;
  v_target_query_count bigint;
begin
  if p_period_month is null
     or p_period_month <> date_trunc('month', p_period_month::timestamp)::date then
    raise exception 'History V2 rollback requires a month start' using errcode = '23514';
  end if;

  select hr.analytics_revision, hr.data_revision
    into v_revision, v_source_revision
    from public.household_revisions hr
   where hr.household_id = p_household_id
   for update;

  if not found then
    raise exception 'Household revision not found' using errcode = 'P0002';
  end if;
  if v_revision <> p_expected_analytics_revision then
    raise exception 'Concurrent analytics publication detected' using errcode = '40001';
  end if;

  select coalesce(array_agg(distinct active.publication_id), '{}')
    into v_current_ids
    from (
      select aa.publication_id
        from public.analytics_artifacts aa
       where aa.household_id = p_household_id
         and aa.period_kind = 'month'
         and aa.period_month = p_period_month
         and aa.contract_version = 'v2'
         and aa.is_active
         and aa.invalidated_at is null
         and aa.publication_id is not null
      union all
      select aqs.publication_id
        from public.analytics_query_snapshots aqs
       where aqs.household_id = p_household_id
         and aqs.period_kind = 'month'
         and aqs.period_month = p_period_month
         and aqs.contract_version = 'v2'
         and aqs.is_active
         and aqs.invalidated_at is null
         and aqs.publication_id is not null
    ) active;

  if cardinality(v_current_ids) > 1 then
    raise exception 'Multiple active History V2 publications detected' using errcode = '23514';
  end if;
  if p_current_publication_id is null then
    if cardinality(v_current_ids) <> 0 then
      raise exception 'Unexpected active History V2 publication' using errcode = '40001';
    end if;
  elsif cardinality(v_current_ids) <> 1 or v_current_ids[1] <> p_current_publication_id then
    raise exception 'Active History V2 publication changed' using errcode = '40001';
  end if;

  if p_target_publication_id is not null then
    select ap.*
      into v_target
      from public.analytics_publications ap
     where ap.publication_id = p_target_publication_id
     for update;
    if not found
       or v_target.household_id <> p_household_id
       or v_target.scope_kind <> 'month'
       or v_target.period_month <> p_period_month
       or v_target.status <> 'published' then
      raise exception 'Invalid History V2 rollback target' using errcode = '23514';
    end if;

    select count(*) into v_target_artifact_count
      from public.analytics_artifacts aa
     where aa.publication_id = p_target_publication_id
       and aa.contract_version = 'v2'
       and aa.invalidated_at is null
       and aa.artifact_key = any(v_target.required_artifact_keys);
    select count(*) into v_target_query_count
      from public.analytics_query_snapshots aqs
     where aqs.publication_id = p_target_publication_id
       and aqs.contract_version = 'v2'
       and aqs.invalidated_at is null
       and aqs.query_key = any(v_target.required_query_keys);
    if v_target_artifact_count <> cardinality(v_target.required_artifact_keys)
       or v_target_query_count <> cardinality(v_target.required_query_keys) then
      raise exception 'Incomplete History V2 rollback target' using errcode = '23514';
    end if;
  end if;

  update public.analytics_artifacts aa
     set is_active = false
   where aa.household_id = p_household_id
     and aa.period_kind = 'month'
     and aa.period_month = p_period_month
     and aa.contract_version = 'v2'
     and aa.is_active;
  update public.analytics_query_snapshots aqs
     set is_active = false
   where aqs.household_id = p_household_id
     and aqs.period_kind = 'month'
     and aqs.period_month = p_period_month
     and aqs.contract_version = 'v2'
     and aqs.is_active;

  if p_target_publication_id is not null then
    update public.analytics_artifacts aa
       set is_active = true
     where aa.publication_id = p_target_publication_id
       and aa.contract_version = 'v2'
       and aa.invalidated_at is null
       and aa.artifact_key = any(v_target.required_artifact_keys);
    update public.analytics_query_snapshots aqs
       set is_active = true
     where aqs.publication_id = p_target_publication_id
       and aqs.contract_version = 'v2'
       and aqs.invalidated_at is null
       and aqs.query_key = any(v_target.required_query_keys);
  end if;

  update public.household_revisions hr
     set analytics_revision = hr.analytics_revision + 1,
         updated_at = now()
   where hr.household_id = p_household_id
   returning hr.analytics_revision, hr.data_revision
        into v_revision, v_source_revision;

  return query select v_revision, v_source_revision, p_target_publication_id;
end;
$$;

revoke all on function public.restore_history_v2_publication(uuid, uuid, uuid, date, bigint)
  from public, anon, authenticated;
grant execute on function public.restore_history_v2_publication(uuid, uuid, uuid, date, bigint)
  to service_role;

commit;
