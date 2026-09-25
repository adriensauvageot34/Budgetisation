begin;

-- C6 prepares this finalizer for C7. Installing it does not advance a revision
-- or activate a generation. One RPC transaction makes D and G/A visible together.
create function public.finalize_global_v2_source_cutover(
  p_household_id uuid,
  p_expected_data_revision bigint,
  p_expected_analytics_revision bigint,
  p_expected_active_publication_id uuid,
  p_candidate_publication_id uuid,
  p_expected_candidate_source_revision bigint
)
returns table(data_revision bigint, analytics_revision bigint, publication_id uuid)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_candidate public.analytics_publications%rowtype;
  v_data_revision bigint;
  v_analytics_revision bigint;
  v_current_count bigint;
  v_current_publication_id uuid;
  v_query_count bigint;
  v_artifact_count bigint;
begin
  select * into v_candidate from public.analytics_publications
    where analytics_publications.publication_id = p_candidate_publication_id for update;
  if not found or v_candidate.household_id is distinct from p_household_id
    or v_candidate.scope_kind <> 'global' or v_candidate.status <> 'draft'
    or v_candidate.global_manifest is null
    or v_candidate.source_revision is distinct from p_expected_candidate_source_revision
    or v_candidate.base_analytics_revision is distinct from p_expected_analytics_revision
    or v_candidate.global_manifest->>'sourceRevision' is distinct from p_expected_candidate_source_revision::text
    or v_candidate.global_manifest->>'baseAnalyticsRevision' is distinct from p_expected_analytics_revision::text
  then raise exception 'C6 sealed candidate guard failed' using errcode = '23514'; end if;

  select r.data_revision, r.analytics_revision into v_data_revision, v_analytics_revision
    from public.household_revisions r where r.household_id = p_household_id for update;
  if not found or v_data_revision is distinct from p_expected_data_revision
    or v_analytics_revision is distinct from p_expected_analytics_revision
    or p_expected_candidate_source_revision <> p_expected_data_revision + 1
  then raise exception 'C6 source or analytics revision guard failed' using errcode = '40001'; end if;

  select count(*), (array_agg(p.publication_id))[1]
    into v_current_count, v_current_publication_id
    from public.analytics_publications p
    where p.household_id = p_household_id and p.scope_kind = 'global'
      and p.status = 'published' and p.published_analytics_revision = v_analytics_revision;
  if v_current_count <> 1 or v_current_publication_id is distinct from p_expected_active_publication_id
  then raise exception 'C6 active publication guard failed' using errcode = '40001'; end if;

  select count(*) into v_query_count from public.analytics_query_snapshots q
    where q.publication_id = p_candidate_publication_id and q.invalidated_at is null;
  select count(*) into v_artifact_count from public.analytics_artifacts a
    where a.publication_id = p_candidate_publication_id and a.invalidated_at is null;
  if v_query_count <> 759 or v_artifact_count <> 17
    or v_query_count <> cardinality(v_candidate.required_query_keys)
    or v_artifact_count <> cardinality(v_candidate.required_artifact_keys)
    or (select array_agg(k order by k) from unnest(v_candidate.required_query_keys) k)
       is distinct from (select array_agg(q.query_key order by q.query_key) from public.analytics_query_snapshots q
         where q.publication_id = p_candidate_publication_id and q.invalidated_at is null)
    or (select array_agg(k order by k) from unnest(v_candidate.required_artifact_keys) k)
       is distinct from (select array_agg(a.artifact_key order by a.artifact_key) from public.analytics_artifacts a
         where a.publication_id = p_candidate_publication_id and a.invalidated_at is null)
  then raise exception 'C6 full resource guard failed' using errcode = '23514'; end if;

  if exists (select 1 from public.analytics_query_snapshots q
      where q.household_id = p_household_id and q.period_kind = 'global' and q.is_active
        and public.is_global_v2_publication(q.publication_id)
        and q.publication_id is distinct from p_expected_active_publication_id)
    or exists (select 1 from public.analytics_artifacts a
      where a.household_id = p_household_id and a.period_kind = 'global' and a.is_active
        and public.is_global_v2_publication(a.publication_id)
        and a.publication_id is distinct from p_expected_active_publication_id)
  then raise exception 'C6 mixed active publication guard failed' using errcode = '23514'; end if;

  update public.household_revisions r set data_revision = p_expected_candidate_source_revision,
    updated_at = now() where r.household_id = p_household_id;
  perform public.publish_global_v2_materialization(p_candidate_publication_id, p_expected_analytics_revision);

  select r.data_revision, r.analytics_revision into v_data_revision, v_analytics_revision
    from public.household_revisions r where r.household_id = p_household_id;
  if v_data_revision <> p_expected_candidate_source_revision
    or v_analytics_revision <> p_expected_analytics_revision + 1
    or not exists (select 1 from public.analytics_publications p
      where p.publication_id = p_candidate_publication_id and p.status = 'published'
        and p.published_analytics_revision = v_analytics_revision)
  then raise exception 'C6 final state guard failed' using errcode = '23514'; end if;

  return query select v_data_revision, v_analytics_revision, p_candidate_publication_id;
end;
$function$;

revoke all on function public.finalize_global_v2_source_cutover(uuid,bigint,bigint,uuid,uuid,bigint)
  from public, anon, authenticated;
grant execute on function public.finalize_global_v2_source_cutover(uuid,bigint,bigint,uuid,uuid,bigint)
  to service_role;

commit;
