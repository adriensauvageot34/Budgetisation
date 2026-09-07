-- P13 Global V2 publication infrastructure. Prepared only: explicit live approval required.
-- Requires the reconciled HC3/HC4 migrations. No existing row is rewritten.
begin;

alter table public.analytics_publications add column global_manifest jsonb;
comment on column public.analytics_publications.global_manifest is
  'Versioned compact Global V2 publication evidence. NULL is LEGACY_UNKNOWN; evidence is never retrofitted.';

create function public.is_global_v2_publication(p_id uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.analytics_publications p
    where p.publication_id = p_id and p.scope_kind = 'global'
      and (p.global_manifest is not null
        or exists (select 1 from public.analytics_query_snapshots q where q.publication_id = p_id and q.resource like 'analysis\_global\_%' escape '\')
        or exists (select 1 from public.analytics_artifacts a where a.publication_id = p_id and a.artifact_family like 'global\_%' escape '\'))
  );
$$;

create function public.guard_global_v2_manifest()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_manifest jsonb := new.global_manifest;
begin
  if tg_op = 'UPDATE' then
    if old.global_manifest is not null and v_manifest is distinct from old.global_manifest then
      raise exception 'Global V2 manifest is immutable' using errcode = '23514';
    end if;
    if old.global_manifest is null and v_manifest is not null and old.status <> 'draft' then
      raise exception 'Cannot retrofit Global V2 evidence' using errcode = '23514';
    end if;
  elsif v_manifest is not null and new.status <> 'draft' then
    raise exception 'Global V2 manifest must originate in a draft' using errcode = '23514';
  end if;
  if v_manifest is null then return new; end if;

  if pg_catalog.jsonb_typeof(v_manifest) is distinct from 'object'
     or pg_catalog.octet_length(v_manifest::text) > 2000000
     or v_manifest->>'formatVersion' is distinct from 'global-v2-publication-manifest@v1'
     or v_manifest->>'profileId' is distinct from 'global-v2-household@v1'
     or new.scope_kind <> 'global'
     or v_manifest->>'householdId' is distinct from new.household_id::text
     or pg_catalog.left(v_manifest->>'asOf', 7) is distinct from pg_catalog.to_char(new.as_of_month, 'YYYY-MM')
     or v_manifest->>'sourceRevision' is distinct from new.source_revision::text
     or v_manifest->>'baseAnalyticsRevision' is distinct from new.base_analytics_revision::text
     or v_manifest#>>'{implementation,status}' is distinct from 'KNOWN'
     or not coalesce((v_manifest#>>'{implementation,digest}') ~ '^[0-9a-f]{64}$', false)
     or not coalesce((v_manifest#>>'{implementation,gitSha}') ~ '^[0-9a-f]{40}$', false)
     or not coalesce((v_manifest->>'publicationFactsHash') ~ '^[0-9a-f]{64}$', false)
     or pg_catalog.jsonb_typeof(v_manifest->'closures') is distinct from 'array'
     or pg_catalog.jsonb_typeof(v_manifest->'externalDependencyRefs') is distinct from 'array'
     or pg_catalog.jsonb_typeof(v_manifest->'artifactVersions') is distinct from 'array'
     or pg_catalog.jsonb_typeof(v_manifest->'queryVersions') is distinct from 'array'
     or pg_catalog.jsonb_typeof(v_manifest->'resourceFamilies') is distinct from 'array' then
    raise exception 'Invalid Global V2 manifest' using errcode = '23514';
  end if;
  if v_manifest->>'manifestHash' is distinct from pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(public.history_manifest_canonical_json(v_manifest - 'manifestHash'), 'UTF8')), 'hex') then
    raise exception 'Global V2 manifest checksum mismatch' using errcode = '23514';
  end if;
  if not coalesce((v_manifest->'requiredQueryKeys') @> pg_catalog.to_jsonb(new.required_query_keys) and (v_manifest->'requiredQueryKeys') <@ pg_catalog.to_jsonb(new.required_query_keys), false)
     or not coalesce((v_manifest->'requiredArtifactKeys') @> pg_catalog.to_jsonb(new.required_artifact_keys) and (v_manifest->'requiredArtifactKeys') <@ pg_catalog.to_jsonb(new.required_artifact_keys), false)
     or pg_catalog.jsonb_array_length(v_manifest->'closures') <> cardinality(new.required_query_keys) + cardinality(new.required_artifact_keys)
     or pg_catalog.jsonb_array_length(v_manifest->'queryVersions') <> cardinality(new.required_query_keys)
     or pg_catalog.jsonb_array_length(v_manifest->'artifactVersions') <> cardinality(new.required_artifact_keys)
     or (select count(distinct value->>'outputKey') from pg_catalog.jsonb_array_elements(v_manifest->'closures')) <> cardinality(new.required_query_keys) + cardinality(new.required_artifact_keys)
     or (select count(distinct value->>'key') from pg_catalog.jsonb_array_elements(v_manifest->'queryVersions')) <> cardinality(new.required_query_keys)
     or (select count(distinct value->>'key') from pg_catalog.jsonb_array_elements(v_manifest->'artifactVersions')) <> cardinality(new.required_artifact_keys) then
    raise exception 'Global V2 manifest required keys mismatch' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function public.guard_global_v2_frozen_publication()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_owner boolean := current_user = pg_catalog.pg_get_userbyid((select relowner from pg_catalog.pg_class where oid = tg_relid));
begin
  if tg_op = 'INSERT' then return new; end if;
  if not public.is_global_v2_publication(old.publication_id) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then raise exception 'Global V2 publication cannot be deleted' using errcode = '23514'; end if;
  if old.published_at is not null or old.published_analytics_revision is not null then
    if pg_catalog.to_jsonb(new) is distinct from pg_catalog.to_jsonb(old) then raise exception 'Published Global V2 metadata is immutable' using errcode = '23514'; end if;
    return new;
  end if;
  if (pg_catalog.to_jsonb(new) - array['global_manifest','status','published_at','published_analytics_revision']) is distinct from
     (pg_catalog.to_jsonb(old) - array['global_manifest','status','published_at','published_analytics_revision']) then
    raise exception 'Global V2 draft identity is immutable' using errcode = '23514';
  end if;
  if (new.status,new.published_at,new.published_analytics_revision) is distinct from (old.status,old.published_at,old.published_analytics_revision)
     and not (old.status = 'draft' and new.status = 'failed' and new.published_at is null and new.published_analytics_revision is null)
     and not (v_owner and old.status = 'draft' and new.status = 'published') then
    raise exception 'Global V2 transition requires authorized Finalize' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function public.guard_global_v2_frozen_content()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_existing jsonb;
  v_publication public.analytics_publications%rowtype;
  v_key text;
  v_global boolean;
  v_owner boolean := current_user = pg_catalog.pg_get_userbyid((select relowner from pg_catalog.pg_class where oid = tg_relid));
  v_technical text[] := array['is_active','invalidated_at','invalidation_revision'];
begin
  if tg_op <> 'INSERT' then v_old := pg_catalog.to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new := pg_catalog.to_jsonb(new); end if;
  v_row := coalesce(v_old,v_new);
  v_global := (v_row->>'period_kind' = 'global' and
    (v_row->>'resource' like 'analysis\_global\_%' escape '\' or v_row->>'artifact_family' like 'global\_%' escape '\'))
    or public.is_global_v2_publication((v_row->>'publication_id')::uuid);
  if not coalesce(v_global,false) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  select * into v_publication from public.analytics_publications where publication_id = (v_row->>'publication_id')::uuid for update;
  if not found then raise exception 'Global V2 requires a publication; read-through writes are forbidden' using errcode = '23514'; end if;
  if tg_op = 'DELETE' then raise exception 'Global V2 content cannot be deleted' using errcode = '23514'; end if;
  if tg_op = 'UPDATE' then
    if (v_new - v_technical) is distinct from (v_old - v_technical) then raise exception 'Global V2 content is immutable' using errcode = '23514'; end if;
    if v_new is distinct from v_old and not v_owner then raise exception 'Global V2 technical state requires workflow owner' using errcode = '23514'; end if;
    return new;
  end if;
  if v_publication.status <> 'draft' or v_publication.global_manifest is not null or v_publication.published_at is not null then raise exception 'Global V2 stage requires unsealed draft' using errcode = '23514'; end if;
  if v_new->>'generation_key' is distinct from v_publication.publication_id::text
     or v_new->>'household_id' is distinct from v_publication.household_id::text
     or v_new->>'period_kind' is distinct from 'global'
     or v_new->>'as_of_month' is distinct from v_publication.as_of_month::text
     or v_new->>'source_revision' is distinct from v_publication.source_revision::text
     or v_new->>'analytics_revision' is distinct from v_publication.base_analytics_revision::text
     or coalesce(v_new->>'contract_version','') = ''
     or v_new#>>'{payload,publicationMeta,publicationId}' is distinct from v_publication.publication_id::text
     or v_new#>>'{payload,publicationMeta,revision}' is distinct from (v_publication.base_analytics_revision + 1)::text
     or v_new->>'is_active' is distinct from 'false' or v_new->>'invalidated_at' is not null then
    raise exception 'Global V2 staging identity/state mismatch' using errcode = '23514';
  end if;
  if tg_table_name = 'analytics_query_snapshots' then
    v_key := v_new->>'query_key';
    if not (v_key = any(v_publication.required_query_keys)) then raise exception 'Unexpected Global V2 query key' using errcode = '23514'; end if;
    select pg_catalog.to_jsonb(q) - 'query_snapshot_id' into v_existing from public.analytics_query_snapshots q where q.publication_id = v_publication.publication_id and q.query_key = v_key;
    v_new := v_new - 'query_snapshot_id';
  else
    v_key := v_new->>'artifact_key';
    if not (v_key = any(v_publication.required_artifact_keys)) then raise exception 'Unexpected Global V2 artifact key' using errcode = '23514'; end if;
    select pg_catalog.to_jsonb(a) - 'artifact_row_id' into v_existing from public.analytics_artifacts a where a.publication_id = v_publication.publication_id and a.artifact_key = v_key;
    v_new := v_new - 'artifact_row_id';
  end if;
  if v_existing is not null and v_existing is distinct from v_new then raise exception 'Global V2 retry changed content' using errcode = '23514'; end if;
  return new;
end;
$$;

create function public.attach_global_v2_manifest(p_publication_id uuid, p_household_id uuid, p_manifest jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_row public.analytics_publications%rowtype;
begin
  select * into v_row from public.analytics_publications where publication_id = p_publication_id and household_id = p_household_id for update;
  if not found then raise exception 'Unknown Global V2 publication' using errcode = '23503'; end if;
  if p_manifest is null then raise exception 'Global V2 manifest required' using errcode = '23514'; end if;
  if v_row.global_manifest = p_manifest then return; end if;
  if v_row.status <> 'draft' or v_row.global_manifest is not null then raise exception 'Global V2 manifest attachment requires draft' using errcode = '23514'; end if;
  update public.analytics_publications set global_manifest = p_manifest where publication_id = p_publication_id;
end;
$$;

create function public.publish_global_v2_materialization(p_publication_id uuid, p_expected_analytics_revision bigint)
returns table(analytics_revision bigint, source_revision bigint)
language plpgsql security definer set search_path = '' as $$
declare
  v_publication public.analytics_publications%rowtype;
  v_data_revision bigint;
  v_analytics_revision bigint;
  v_next bigint;
  v_query_count bigint;
  v_artifact_count bigint;
begin
  select * into v_publication from public.analytics_publications where publication_id = p_publication_id for update;
  if not found then raise exception 'Unknown Global V2 publication' using errcode = '23503'; end if;
  if v_publication.status = 'published' then
    if not exists (select 1 from public.analytics_query_snapshots where publication_id = p_publication_id and is_active) then raise exception 'Published retry cannot reactivate an inactive generation' using errcode = '23514'; end if;
    return query select v_publication.published_analytics_revision,v_publication.source_revision; return;
  end if;
  if v_publication.status <> 'draft' or v_publication.scope_kind <> 'global' or v_publication.global_manifest is null then raise exception 'Global V2 Finalize requires sealed global draft' using errcode = '23514'; end if;
  select r.data_revision,r.analytics_revision into v_data_revision,v_analytics_revision from public.household_revisions r where r.household_id = v_publication.household_id for update;
  if v_analytics_revision is distinct from p_expected_analytics_revision or v_analytics_revision is distinct from v_publication.base_analytics_revision then raise exception 'Concurrent analytics revision' using errcode = '40001'; end if;
  if v_data_revision is distinct from v_publication.source_revision then raise exception 'Superseded Global V2 source revision' using errcode = '40001'; end if;
  select count(*) into v_query_count from public.analytics_query_snapshots where publication_id = p_publication_id and invalidated_at is null;
  select count(*) into v_artifact_count from public.analytics_artifacts where publication_id = p_publication_id and invalidated_at is null;
  if v_query_count <> cardinality(v_publication.required_query_keys) or v_artifact_count <> cardinality(v_publication.required_artifact_keys) then raise exception 'Global V2 generation incomplete or contains extra rows' using errcode = '23514'; end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(v_publication.global_manifest->'queryVersions') v
    left join public.analytics_query_snapshots q on q.publication_id=p_publication_id and q.query_key=v->>'key'
    where q.query_key is null or q.invalidated_at is not null or q.contract_version is distinct from v->>'contractVersion'
      or q.method_signature is distinct from v->>'methodSignature' or q.payload#>>'{resourceMeta,resourceInputHash}' is distinct from v->>'resourceInputHash'
      or q.payload#>'{resourceMeta,policyVersions}' is distinct from v->'policyVersions' or q.payload#>>'{publicationMeta,manifestHash}' is distinct from v_publication.global_manifest->>'manifestHash'
      or q.payload#>>'{publicationMeta,factsHash}' is distinct from v_publication.global_manifest->>'publicationFactsHash'
  ) or exists (
    select 1 from pg_catalog.jsonb_array_elements(v_publication.global_manifest->'artifactVersions') v
    left join public.analytics_artifacts a on a.publication_id=p_publication_id and a.artifact_key=v->>'key'
    where a.artifact_key is null or a.invalidated_at is not null or a.contract_version is distinct from v->>'contractVersion'
      or a.payload#>>'{resourceMeta,resourceInputHash}' is distinct from v->>'resourceInputHash' or a.payload#>>'{resourceMeta,methodSignature}' is distinct from v->>'methodSignature'
      or a.payload#>'{resourceMeta,policyVersions}' is distinct from v->'policyVersions' or a.payload#>>'{publicationMeta,manifestHash}' is distinct from v_publication.global_manifest->>'manifestHash'
      or a.payload#>>'{publicationMeta,factsHash}' is distinct from v_publication.global_manifest->>'publicationFactsHash'
  ) then raise exception 'Global V2 staged payload/manifest mismatch' using errcode = '23514'; end if;

  update public.analytics_artifacts a set is_active=false where a.household_id=v_publication.household_id and a.period_kind='global' and a.is_active and a.publication_id is distinct from p_publication_id and public.is_global_v2_publication(a.publication_id);
  update public.analytics_query_snapshots q set is_active=false where q.household_id=v_publication.household_id and q.period_kind='global' and q.is_active and q.publication_id is distinct from p_publication_id and public.is_global_v2_publication(q.publication_id);
  update public.analytics_artifacts set is_active=true where publication_id=p_publication_id;
  update public.analytics_query_snapshots set is_active=true where publication_id=p_publication_id;
  v_next := v_analytics_revision + 1;
  update public.household_revisions set analytics_revision=v_next,updated_at=now() where household_id=v_publication.household_id;
  update public.analytics_publications set status='published',published_analytics_revision=v_next,published_at=now() where publication_id=p_publication_id;
  if exists (select 1 from public.analytics_query_snapshots q where q.household_id=v_publication.household_id and q.period_kind='global' and q.is_active and q.publication_id is distinct from p_publication_id and public.is_global_v2_publication(q.publication_id))
     or exists (select 1 from public.analytics_artifacts a where a.household_id=v_publication.household_id and a.period_kind='global' and a.is_active and a.publication_id is distinct from p_publication_id and public.is_global_v2_publication(a.publication_id)) then raise exception 'Global V2 residual active key' using errcode='23514'; end if;
  return query select v_next,v_publication.source_revision;
end;
$$;

create function public.restore_global_v2_publication(p_current_publication_id uuid,p_target_publication_id uuid,p_household_id uuid,p_expected_analytics_revision bigint)
returns table(analytics_revision bigint,publication_id uuid)
language plpgsql security definer set search_path='' as $$
declare v_current public.analytics_publications%rowtype; v_target public.analytics_publications%rowtype; v_current_revision bigint; v_next bigint;
begin
  select r.analytics_revision into v_current_revision from public.household_revisions r where r.household_id=p_household_id for update;
  if v_current_revision is distinct from p_expected_analytics_revision then raise exception 'Concurrent analytics revision' using errcode='40001'; end if;
  select p.* into v_current from public.analytics_publications p where p.publication_id=p_current_publication_id and p.household_id=p_household_id for update;
  select p.* into v_target from public.analytics_publications p where p.publication_id=p_target_publication_id and p.household_id=p_household_id for update;
  if v_current.global_manifest is null or v_target.global_manifest is null or v_current.status <> 'published' or v_target.status <> 'published' then raise exception 'Invalid Global V2 rollback identity' using errcode='23514'; end if;
  if not exists (select 1 from public.analytics_query_snapshots q where q.publication_id=p_current_publication_id and q.is_active) then raise exception 'Current Global V2 generation is not active' using errcode='23514'; end if;
  if exists (select 1 from public.analytics_query_snapshots q where q.publication_id=p_target_publication_id and q.invalidated_at is not null) or exists (select 1 from public.analytics_artifacts a where a.publication_id=p_target_publication_id and a.invalidated_at is not null) then raise exception 'Invalidated Global V2 rollback target' using errcode='23514'; end if;
  if (select count(*) from public.analytics_query_snapshots q where q.publication_id=p_target_publication_id) <> cardinality(v_target.required_query_keys) or (select count(*) from public.analytics_artifacts a where a.publication_id=p_target_publication_id) <> cardinality(v_target.required_artifact_keys) then raise exception 'Incomplete Global V2 rollback target' using errcode='23514'; end if;
  update public.analytics_query_snapshots q set is_active=false where q.household_id=p_household_id and q.period_kind='global' and q.is_active and public.is_global_v2_publication(q.publication_id);
  update public.analytics_artifacts a set is_active=false where a.household_id=p_household_id and a.period_kind='global' and a.is_active and public.is_global_v2_publication(a.publication_id);
  update public.analytics_query_snapshots q set is_active=true where q.publication_id=p_target_publication_id;
  update public.analytics_artifacts a set is_active=true where a.publication_id=p_target_publication_id;
  v_next:=v_current_revision+1; update public.household_revisions set analytics_revision=v_next,updated_at=now() where household_id=p_household_id;
  return query select v_next,p_target_publication_id;
end;
$$;

create trigger global_v2_manifest_guard before insert or update on public.analytics_publications for each row execute function public.guard_global_v2_manifest();
create trigger global_v2_frozen_publication_guard before update or delete on public.analytics_publications for each row execute function public.guard_global_v2_frozen_publication();
create trigger global_v2_frozen_artifact_guard before insert or update or delete on public.analytics_artifacts for each row execute function public.guard_global_v2_frozen_content();
create trigger global_v2_frozen_snapshot_guard before insert or update or delete on public.analytics_query_snapshots for each row execute function public.guard_global_v2_frozen_content();

create function public.global_v2_publication_contract()
returns table(boundary_version text) language plpgsql security invoker set search_path='' as $$
begin
  if (select count(*) from pg_catalog.pg_trigger where not tgisinternal and tgenabled='O' and (tgrelid,tgname) in (
    ('public.analytics_publications'::regclass,'global_v2_manifest_guard'),('public.analytics_publications'::regclass,'global_v2_frozen_publication_guard'),
    ('public.analytics_artifacts'::regclass,'global_v2_frozen_artifact_guard'),('public.analytics_query_snapshots'::regclass,'global_v2_frozen_snapshot_guard'))) <> 4 then
    raise exception 'Global V2 publication boundary is not installed' using errcode='23514';
  end if;
  return query select 'global-v2-publication@v1'::text;
end;
$$;

revoke all on function public.is_global_v2_publication(uuid) from public,anon,authenticated;
revoke all on function public.guard_global_v2_manifest() from public,anon,authenticated;
revoke all on function public.guard_global_v2_frozen_publication() from public,anon,authenticated;
revoke all on function public.guard_global_v2_frozen_content() from public,anon,authenticated;
revoke all on function public.attach_global_v2_manifest(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.publish_global_v2_materialization(uuid,bigint) from public,anon,authenticated;
revoke all on function public.restore_global_v2_publication(uuid,uuid,uuid,bigint) from public,anon,authenticated;
revoke all on function public.global_v2_publication_contract() from public,anon,authenticated;
grant execute on function public.is_global_v2_publication(uuid) to service_role;
grant execute on function public.attach_global_v2_manifest(uuid,uuid,jsonb) to service_role;
grant execute on function public.publish_global_v2_materialization(uuid,bigint) to service_role;
grant execute on function public.restore_global_v2_publication(uuid,uuid,uuid,bigint) to service_role;
grant execute on function public.global_v2_publication_contract() to service_role;
revoke truncate,trigger on public.analytics_publications,public.analytics_artifacts,public.analytics_query_snapshots from service_role;

commit;
