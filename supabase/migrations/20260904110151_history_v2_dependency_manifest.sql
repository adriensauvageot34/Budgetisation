-- HC3: additive metadata only. Apply only after explicit human approval.
begin;

alter table public.analytics_publications
  add column dependency_manifest jsonb;
comment on column public.analytics_publications.dependency_manifest is
  'Versioned compact History dependency evidence; NULL means legacy/unknown, never reconstructed. Immutable after attachment.';

-- JSON serialization shared with canonicalSerializeQueryParams (ASCII manifest keys).
create function public.history_manifest_canonical_json(p_value jsonb)
returns text language plpgsql immutable strict set search_path = '' as $$
declare v_result text;
begin
  case pg_catalog.jsonb_typeof(p_value)
    when 'object' then
      select '{' || coalesce(pg_catalog.string_agg(pg_catalog.to_jsonb(key)::text || ':' || public.history_manifest_canonical_json(value), ',' order by key collate "C"), '') || '}'
        into v_result from pg_catalog.jsonb_each(p_value);
    when 'array' then
      select '[' || coalesce(pg_catalog.string_agg(public.history_manifest_canonical_json(value), ',' order by ordinal), '') || ']'
        into v_result from pg_catalog.jsonb_array_elements(p_value) with ordinality as items(value, ordinal);
    else v_result := p_value::text;
  end case;
  return v_result;
end;
$$;

create function public.guard_history_v2_dependency_manifest()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_manifest jsonb := new.dependency_manifest;
  v_query_count bigint;
  v_artifact_count bigint;
begin
  if tg_op = 'UPDATE' then
    if old.dependency_manifest is not null and v_manifest is distinct from old.dependency_manifest then
      raise exception 'History dependency manifest is immutable' using errcode = '23514';
    end if;
    if old.dependency_manifest is null and v_manifest is not null and old.status <> 'draft' then
      raise exception 'Cannot retrofit evidence on a historical publication' using errcode = '23514';
    end if;
  elsif v_manifest is not null and new.status <> 'draft' then
    raise exception 'A manifest must originate in a draft' using errcode = '23514';
  end if;

  if v_manifest is not null then
    if pg_catalog.jsonb_typeof(v_manifest) is distinct from 'object'
       or pg_catalog.octet_length(v_manifest::text) > 2000000
       or v_manifest->>'formatVersion' is distinct from 'history-v2-dependency-manifest@v2'
       or v_manifest->>'profileId' is distinct from 'history-v2-month@v1'
       or v_manifest->>'householdId' is distinct from new.household_id::text
       or new.scope_kind <> 'month'
       or v_manifest->>'month' is distinct from pg_catalog.to_char(new.period_month, 'YYYY-MM')
       or v_manifest#>>'{implementation,status}' is distinct from 'KNOWN'
       or not coalesce((v_manifest#>>'{implementation,digest}') ~ '^[0-9a-f]{64}$', false)
       or not coalesce((v_manifest#>>'{implementation,gitSha}') ~ '^[0-9a-f]{40}$', false)
       or not coalesce((v_manifest->>'publicationFactsHash') ~ '^[0-9a-f]{64}$', false)
       or pg_catalog.jsonb_typeof(v_manifest->'factDependencies') is distinct from 'array'
       or pg_catalog.jsonb_typeof(v_manifest->'externalQueryRefs') is distinct from 'array'
       or pg_catalog.jsonb_typeof(v_manifest->'queryVersions') is distinct from 'array'
       or pg_catalog.jsonb_typeof(v_manifest->'artifactVersions') is distinct from 'array'
       or pg_catalog.jsonb_typeof(v_manifest->'resourceFamilies') is distinct from 'array' then
      raise exception 'Invalid History dependency manifest' using errcode = '23514';
    end if;
    if v_manifest->>'manifestHash' is distinct from pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(public.history_manifest_canonical_json(v_manifest - 'manifestHash'), 'UTF8')), 'hex') then
      raise exception 'History dependency manifest checksum mismatch' using errcode = '23514';
    end if;
    if pg_catalog.jsonb_array_length(v_manifest->'resourceFamilies') <> 15
       or (select count(distinct value) from pg_catalog.jsonb_array_elements_text(v_manifest->'resourceFamilies')) <> 15
       or pg_catalog.jsonb_array_length(v_manifest->'factDependencies') <> cardinality(new.required_query_keys) + cardinality(new.required_artifact_keys)
       or not coalesce((v_manifest->'requiredQueryKeys') @> pg_catalog.to_jsonb(new.required_query_keys) and (v_manifest->'requiredQueryKeys') <@ pg_catalog.to_jsonb(new.required_query_keys), false)
       or not coalesce((v_manifest->'requiredArtifactKeys') @> pg_catalog.to_jsonb(new.required_artifact_keys) and (v_manifest->'requiredArtifactKeys') <@ pg_catalog.to_jsonb(new.required_artifact_keys), false)
       or pg_catalog.jsonb_array_length(v_manifest->'queryVersions') <> cardinality(new.required_query_keys)
       or (select count(distinct value->>'queryKey') from pg_catalog.jsonb_array_elements(v_manifest->'queryVersions')) <> cardinality(new.required_query_keys)
       or pg_catalog.jsonb_array_length(v_manifest->'artifactVersions') <> 2
       or (select count(distinct value->>'artifactKey') from pg_catalog.jsonb_array_elements(v_manifest->'artifactVersions')) <> 2
       or cardinality(new.required_artifact_keys) <> 2 then
      raise exception 'History manifest required keys mismatch' using errcode = '23514';
    end if;
  end if;

  -- Existing Finalize's transaction will roll back all activations if this guard fails.
  -- Rollback changes active flags, not publication status: old NULL manifests remain usable.
  if tg_op = 'UPDATE' and old.status = 'draft' and new.status = 'published' then
    if v_manifest is null then
      if exists (select 1 from public.analytics_query_snapshots q where q.publication_id = new.publication_id and q.resource like 'history\_%' escape '\' and q.contract_version = 'v2') then
        raise exception 'History Finalize requires a dependency manifest' using errcode = '23514';
      end if;
      return new;
    end if;

    select count(*) into v_query_count from public.analytics_query_snapshots where publication_id = new.publication_id;
    select count(*) into v_artifact_count from public.analytics_artifacts where publication_id = new.publication_id;
    if v_query_count <> cardinality(new.required_query_keys) or v_artifact_count <> 2 then
      raise exception 'History manifest generation is incomplete or contains extra rows' using errcode = '23514';
    end if;
    if exists (
      select 1 from pg_catalog.jsonb_array_elements(v_manifest->'queryVersions') v
      left join public.analytics_query_snapshots q on q.publication_id = new.publication_id and q.query_key = v->>'queryKey'
      where q.query_key is null or not (q.query_key = any(new.required_query_keys))
        or q.household_id <> new.household_id or q.period_month is distinct from new.period_month
        or q.invalidated_at is not null or q.contract_version <> 'v2' or v->>'contractVersion' is distinct from 'v2'
        or q.method_signature is distinct from v->>'methodSignature'
        or q.payload->>'resourceInputHash' is distinct from v->>'resourceInputHash'
        or q.payload->'policyVersions' is distinct from v->'policyVersions'
        or q.payload#>'{publicationMeta,policyVersions}' is distinct from v->'policyVersions'
        or q.payload#>>'{publicationMeta,contractVersion}' is distinct from 'v2'
        or q.payload#>>'{publicationMeta,publicationId}' is distinct from new.publication_id::text
        or q.payload#>>'{publicationMeta,revision}' is distinct from new.published_analytics_revision::text
        or q.payload#>>'{publicationMeta,factsHash}' is distinct from v_manifest->>'publicationFactsHash'
    ) or exists (
      select 1 from pg_catalog.jsonb_array_elements(v_manifest->'artifactVersions') v
      left join public.analytics_artifacts a on a.publication_id = new.publication_id and a.artifact_key = v->>'artifactKey'
      where a.artifact_key is null or not (a.artifact_key = any(new.required_artifact_keys))
        or a.household_id <> new.household_id or a.period_month is distinct from new.period_month
        or a.invalidated_at is not null or a.contract_version <> 'v2' or v->>'contractVersion' is distinct from 'v2'
        or a.payload->>'artifactInputHash' is distinct from v->>'artifactInputHash'
        or a.payload#>>'{payload,artifactInputHash}' is distinct from v->>'artifactInputHash'
        or a.payload#>'{payload,dependencyPolicies}' is distinct from v->'policyVersions'
        or a.payload#>'{publicationMeta,policyVersions}' is distinct from v->'policyVersions'
        or a.payload#>>'{publicationMeta,contractVersion}' is distinct from 'v2'
        or a.payload#>>'{publicationMeta,publicationId}' is distinct from new.publication_id::text
        or a.payload#>>'{publicationMeta,revision}' is distinct from new.published_analytics_revision::text
        or a.payload#>>'{publicationMeta,factsHash}' is distinct from v_manifest->>'publicationFactsHash'
    ) then
      raise exception 'History staged payload/manifest mismatch' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger history_v2_dependency_manifest_guard
before insert or update on public.analytics_publications
for each row execute function public.guard_history_v2_dependency_manifest();

create function public.attach_history_v2_dependency_manifest(p_publication_id uuid, p_household_id uuid, p_manifest jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_row public.analytics_publications%rowtype;
begin
  select * into v_row from public.analytics_publications
    where publication_id = p_publication_id and household_id = p_household_id for update;
  if not found then raise exception 'Unknown household publication' using errcode = '23503'; end if;
  if p_manifest is null then raise exception 'Manifest required' using errcode = '23514'; end if;
  if v_row.dependency_manifest = p_manifest then return; end if;
  if v_row.status <> 'draft' then raise exception 'Manifest attachment requires draft' using errcode = '23514'; end if;
  update public.analytics_publications set dependency_manifest = p_manifest where publication_id = p_publication_id;
end;
$$;

revoke all on function public.history_manifest_canonical_json(jsonb) from public, anon, authenticated;
revoke all on function public.guard_history_v2_dependency_manifest() from public, anon, authenticated;
revoke all on function public.attach_history_v2_dependency_manifest(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.attach_history_v2_dependency_manifest(uuid, uuid, jsonb) to service_role;
-- Existing table RLS / grants remain unchanged. No new browser access.
commit;
