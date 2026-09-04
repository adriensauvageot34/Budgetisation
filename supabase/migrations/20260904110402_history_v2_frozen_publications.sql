-- HC4. Additive, no historical rows updated. Requires HC3; explicit live approval required.
begin;

create function public.is_history_v2_publication(p_id uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (select 1 from public.analytics_publications p where p.publication_id = p_id
    and (p.dependency_manifest is not null
      or exists (select 1 from public.analytics_query_snapshots q where q.publication_id = p_id
        and q.contract_version = 'v2' and q.resource like 'history\_%' escape '\')
      or exists (select 1 from public.analytics_artifacts a where a.publication_id = p_id
        and a.contract_version = 'v2' and a.artifact_family in ('calendar_semantic_month', 'daily_economic_ledger_month'))));
$$;

-- INVOKER is intentional: SECURITY DEFINER workflow RPCs execute as the table owner;
-- ordinary service_role DML does not. A caller-controlled GUC is NOT an authorization.
create function public.guard_history_v2_frozen_publication()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_owner boolean := current_user = pg_catalog.pg_get_userbyid((select relowner from pg_catalog.pg_class where oid = tg_relid));
begin
  if tg_op = 'INSERT' then return new; end if;
  if not public.is_history_v2_publication(old.publication_id) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'History publication identity cannot be deleted' using errcode = '23514';
  end if;
  if old.status = 'published' or old.published_at is not null or old.published_analytics_revision is not null then
    if pg_catalog.to_jsonb(new) is distinct from pg_catalog.to_jsonb(old) then
      raise exception 'FROZEN_MONTH: published History metadata is immutable' using errcode = '23514';
    end if;
    return new;
  end if;
  if (pg_catalog.to_jsonb(new) - array['dependency_manifest','status','published_at','published_analytics_revision'])
     is distinct from (pg_catalog.to_jsonb(old) - array['dependency_manifest','status','published_at','published_analytics_revision']) then
    raise exception 'History draft identity is fixed after first stage; use a new publication' using errcode = '23514';
  end if;
  if (new.status,new.published_at,new.published_analytics_revision) is distinct from
     (old.status,old.published_at,old.published_analytics_revision) then
    -- An ordinary server may abandon a draft, but cannot impersonate Finalize.
    if not (old.status = 'draft' and new.status = 'failed'
        and new.published_at is null and new.published_analytics_revision is null)
       and not (v_owner and old.status = 'draft' and new.status = 'published') then
      raise exception 'History status transition requires authorized Finalize' using errcode = '23514';
    end if;
  end if;
  if v_owner and old.status = 'draft' and new.status = 'published' then
    -- The shared Finalize matches logical keys. A new History manifest can DROP
    -- detail keys; those old rows must not survive as a partially active P1.
    -- This runs inside the SAME existing Finalize transaction, after HC3 checks.
    update public.analytics_artifacts a set is_active = false
      where a.household_id = new.household_id and a.period_month = new.period_month
        and a.contract_version = 'v2' and a.is_active
        and a.artifact_family in ('calendar_semantic_month','daily_economic_ledger_month')
        and a.publication_id is distinct from new.publication_id;
    update public.analytics_query_snapshots q set is_active = false
      where q.household_id = new.household_id and q.period_month = new.period_month
        and q.contract_version = 'v2' and q.is_active
        and q.resource like 'history\_%' escape '\'
        and q.publication_id is distinct from new.publication_id;
  end if;
  return new;
end;
$$;

create function public.guard_history_v2_frozen_content()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_existing jsonb;
  v_publication public.analytics_publications%rowtype;
  v_history boolean;
  v_key text;
  v_owner boolean := current_user = pg_catalog.pg_get_userbyid((select relowner from pg_catalog.pg_class where oid = tg_relid));
  v_technical text[] := array['is_active','invalidated_at','invalidation_revision'];
begin
  if tg_op <> 'INSERT' then v_old := pg_catalog.to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new := pg_catalog.to_jsonb(new); end if;
  v_row := coalesce(v_old,v_new);
  v_history := (v_row->>'contract_version' = 'v2' and
    (v_row->>'resource' like 'history\_%' escape '\'
     or v_row->>'artifact_family' in ('calendar_semantic_month','daily_economic_ledger_month')))
    or public.is_history_v2_publication((v_row->>'publication_id')::uuid);
  if tg_op = 'UPDATE' then
    v_history := v_history or (v_new->>'contract_version' = 'v2' and
      (v_new->>'resource' like 'history\_%' escape '\'
       or v_new->>'artifact_family' in ('calendar_semantic_month','daily_economic_ledger_month')))
      or public.is_history_v2_publication((v_new->>'publication_id')::uuid);
  end if;
  if not coalesce(v_history,false) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  -- Same lock as Finalize: a stage cannot slip past publication status verification.
  select * into v_publication from public.analytics_publications
    where publication_id = (v_row->>'publication_id')::uuid for update;
  if not found then
    -- Existing read-through legacy rows can be retired/invalidated by workflow,
    -- but never rewritten, promoted into a new identity, or inserted anew.
    if tg_op = 'UPDATE' and v_owner and v_old->>'publication_id' is null
       and (v_new - v_technical) is not distinct from (v_old - v_technical)
       and not (v_new->>'is_active' = 'true' and v_old->>'is_active' = 'false') then return new; end if;
    raise exception 'History requires a publication; no read-through writes' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then
    raise exception 'History staged/published content cannot be deleted; abandon draft instead' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    -- All business columns, including future ones, are immutable. Only these three
    -- operational fields are excluded. Even an inactive retry cannot change truth.
    if (v_new - v_technical) is distinct from (v_old - v_technical) then
      raise exception 'FROZEN_MONTH: History content is immutable; create a new generation' using errcode = '23514';
    end if;
    if v_new is distinct from v_old and not v_owner then
      raise exception 'History technical state requires authorized workflow RPC' using errcode = '23514';
    end if;
    return new;
  end if;

  if v_publication.status <> 'draft' or v_publication.published_at is not null
     or v_publication.published_analytics_revision is not null or v_publication.dependency_manifest is not null then
    raise exception 'History stage requires an unsealed, never-published draft' using errcode = '23514';
  end if;
  if v_new->>'generation_key' is distinct from v_publication.publication_id::text
     or v_new->>'household_id' is distinct from v_publication.household_id::text
     or v_new->>'period_kind' is distinct from 'month'
     or v_new->>'period_month' is distinct from v_publication.period_month::text
     or v_new->>'source_revision' is distinct from v_publication.source_revision::text
     or v_new->>'analytics_revision' is distinct from v_publication.base_analytics_revision::text
     or v_new->>'contract_version' is distinct from 'v2'
     or v_new#>>'{payload,publicationMeta,publicationId}' is distinct from v_publication.publication_id::text
     or v_new#>>'{payload,publicationMeta,revision}' is distinct from (v_publication.base_analytics_revision + 1)::text
     or v_new->>'is_active' is distinct from 'false'
     or v_new->>'invalidated_at' is not null or v_new->>'invalidation_revision' is not null then
    raise exception 'History staging identity/state mismatch' using errcode = '23514';
  end if;
  if tg_table_name = 'analytics_query_snapshots' then
    v_key := v_new->>'query_key';
    if not (v_key = any(v_publication.required_query_keys)) then
      raise exception 'Unexpected History query key' using errcode = '23514';
    end if;
    select pg_catalog.to_jsonb(q) - 'query_snapshot_id' into v_existing
      from public.analytics_query_snapshots q where q.publication_id = v_publication.publication_id and q.query_key = v_key;
    v_new := v_new - 'query_snapshot_id';
  else
    v_key := v_new->>'artifact_key';
    if not (v_key = any(v_publication.required_artifact_keys)) then
      raise exception 'Unexpected History artifact key' using errcode = '23514';
    end if;
    select pg_catalog.to_jsonb(a) - 'artifact_row_id' into v_existing
      from public.analytics_artifacts a where a.publication_id = v_publication.publication_id and a.artifact_key = v_key;
    v_new := v_new - 'artifact_row_id';
  end if;
  if v_existing is not null and v_existing is distinct from v_new then
    raise exception 'History retry changed content/identity; create a new generation' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger history_v2_frozen_publication_guard before update or delete on public.analytics_publications
  for each row execute function public.guard_history_v2_frozen_publication();
create trigger history_v2_frozen_artifact_guard before insert or update or delete on public.analytics_artifacts
  for each row execute function public.guard_history_v2_frozen_content();
create trigger history_v2_frozen_snapshot_guard before insert or update or delete on public.analytics_query_snapshots
  for each row execute function public.guard_history_v2_frozen_content();

revoke all on function public.is_history_v2_publication(uuid) from public, anon, authenticated;
revoke all on function public.guard_history_v2_frozen_publication() from public, anon, authenticated;
revoke all on function public.guard_history_v2_frozen_content() from public, anon, authenticated;
grant execute on function public.is_history_v2_publication(uuid) to service_role;
-- TRUNCATE bypasses row triggers. TRIGGER would permit installing a later trigger
-- that changes NEW after this guard. Neither is a normal operational capability.
revoke truncate, trigger on public.analytics_publications, public.analytics_artifacts, public.analytics_query_snapshots from service_role;

-- Read-only deployment handshake: fail closed before first write if absent/disabled.
create function public.history_v2_frozen_publication_contract()
returns table(boundary_version text) language plpgsql security invoker set search_path = '' as $$
begin
  if (select count(*) from pg_catalog.pg_trigger where not tgisinternal and tgenabled = 'O'
      and (tgrelid,tgname) in (
        ('public.analytics_publications'::regclass,'history_v2_dependency_manifest_guard'),
        ('public.analytics_publications'::regclass,'history_v2_frozen_publication_guard'),
        ('public.analytics_artifacts'::regclass,'history_v2_frozen_artifact_guard'),
        ('public.analytics_query_snapshots'::regclass,'history_v2_frozen_snapshot_guard'))) <> 4 then
    raise exception 'History frozen publication boundary is not installed' using errcode = '23514';
  end if;
  return query select 'history-frozen-month@v1'::text;
end;
$$;
revoke all on function public.history_v2_frozen_publication_contract() from public, anon, authenticated;
grant execute on function public.history_v2_frozen_publication_contract() to service_role;

commit;
