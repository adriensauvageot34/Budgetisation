-- Preserve the frozen Global V2 and History V2 boundaries without materializing
-- complete artifact/snapshot rows on their normal insert and finalize paths.
begin;

create or replace function public.guard_global_v2_frozen_content()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_publication public.analytics_publications%rowtype;
  v_existing_artifact public.analytics_artifacts%rowtype;
  v_existing_snapshot public.analytics_query_snapshots%rowtype;
  v_existing_id bigint;
  v_publication_id uuid;
  v_key text;
  v_old_global boolean := false;
  v_new_global boolean := false;
  v_owner boolean := current_user = pg_catalog.pg_get_userbyid((select relowner from pg_catalog.pg_class where oid = tg_relid));
begin
  -- Route with scalar columns only. Both identities are considered on UPDATE so
  -- changing a marker or publication_id cannot move frozen content out of scope.
  if tg_table_name = 'analytics_query_snapshots' then
    if tg_op <> 'INSERT' then
      v_old_global := (old.period_kind = 'global' and old.resource like 'analysis\_global\_%' escape '\')
        or public.is_global_v2_publication(old.publication_id);
    end if;
    if tg_op <> 'DELETE' then
      v_new_global := (new.period_kind = 'global' and new.resource like 'analysis\_global\_%' escape '\')
        or public.is_global_v2_publication(new.publication_id);
    end if;
  else
    if tg_op <> 'INSERT' then
      v_old_global := (old.period_kind = 'global' and old.artifact_family like 'global\_%' escape '\')
        or public.is_global_v2_publication(old.publication_id);
    end if;
    if tg_op <> 'DELETE' then
      v_new_global := (new.period_kind = 'global' and new.artifact_family like 'global\_%' escape '\')
        or public.is_global_v2_publication(new.publication_id);
    end if;
  end if;

  if not coalesce(v_old_global or v_new_global, false) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'INSERT' or not v_old_global then
    v_publication_id := new.publication_id;
  else
    v_publication_id := old.publication_id;
  end if;

  select * into v_publication
    from public.analytics_publications
    where publication_id = v_publication_id
    for update;
  if not found then
    raise exception 'Global V2 requires a publication; read-through writes are forbidden' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Global V2 content cannot be deleted' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    if tg_table_name = 'analytics_query_snapshots' then
      if old.query_snapshot_id is distinct from new.query_snapshot_id
         or old.query_key is distinct from new.query_key
         or old.generation_key is distinct from new.generation_key
         or old.household_id is distinct from new.household_id
         or old.resource is distinct from new.resource
         or old.scope_hash is distinct from new.scope_hash
         or old.normalized_param_signature is distinct from new.normalized_param_signature
         or old.subject_kind is distinct from new.subject_kind
         or old.subject_id is distinct from new.subject_id
         or old.period_kind is distinct from new.period_kind
         or old.period_month is distinct from new.period_month
         or old.as_of_month is distinct from new.as_of_month
         or old.source_revision is distinct from new.source_revision
         or old.analytics_revision is distinct from new.analytics_revision
         or old.contract_version is distinct from new.contract_version
         or old.method_signature is distinct from new.method_signature
         or old.payload is distinct from new.payload
         or old.computed_at is distinct from new.computed_at
         or old.expires_at is distinct from new.expires_at
         or old.publication_id is distinct from new.publication_id then
        raise exception 'Global V2 content is immutable' using errcode = '23514';
      end if;
    else
      if old.artifact_row_id is distinct from new.artifact_row_id
         or old.artifact_key is distinct from new.artifact_key
         or old.generation_key is distinct from new.generation_key
         or old.household_id is distinct from new.household_id
         or old.subject_kind is distinct from new.subject_kind
         or old.subject_id is distinct from new.subject_id
         or old.period_kind is distinct from new.period_kind
         or old.period_month is distinct from new.period_month
         or old.as_of_month is distinct from new.as_of_month
         or old.artifact_family is distinct from new.artifact_family
         or old.metric_id is distinct from new.metric_id
         or old.dimension_key is distinct from new.dimension_key
         or old.bucket_key is distinct from new.bucket_key
         or old.scope_hash is distinct from new.scope_hash
         or old.filter_signature is distinct from new.filter_signature
         or old.method_version is distinct from new.method_version
         or old.contract_version is distinct from new.contract_version
         or old.source_revision is distinct from new.source_revision
         or old.analytics_revision is distinct from new.analytics_revision
         or old.payload is distinct from new.payload
         or old.computed_at is distinct from new.computed_at
         or old.publication_id is distinct from new.publication_id then
        raise exception 'Global V2 content is immutable' using errcode = '23514';
      end if;
    end if;
    if (old.is_active, old.invalidated_at, old.invalidation_revision) is distinct from
       (new.is_active, new.invalidated_at, new.invalidation_revision) and not v_owner then
      raise exception 'Global V2 technical state requires workflow owner' using errcode = '23514';
    end if;
    return new;
  end if;

  if v_publication.status <> 'draft' or v_publication.global_manifest is not null
     or v_publication.published_at is not null then
    raise exception 'Global V2 stage requires unsealed draft' using errcode = '23514';
  end if;
  if new.generation_key is distinct from v_publication.publication_id::text
     or new.household_id is distinct from v_publication.household_id
     or new.period_kind is distinct from 'global'
     or new.as_of_month is distinct from v_publication.as_of_month
     or new.source_revision is distinct from v_publication.source_revision
     or new.analytics_revision is distinct from v_publication.base_analytics_revision
     or coalesce(new.contract_version, '') = ''
     or new.payload #>> '{publicationMeta,publicationId}' is distinct from v_publication.publication_id::text
     or new.payload #>> '{publicationMeta,revision}' is distinct from (v_publication.base_analytics_revision + 1)::text
     or new.is_active is distinct from false or new.invalidated_at is not null then
    raise exception 'Global V2 staging identity/state mismatch' using errcode = '23514';
  end if;

  if tg_table_name = 'analytics_query_snapshots' then
    v_key := new.query_key;
    if not (v_key = any(v_publication.required_query_keys)) then
      raise exception 'Unexpected Global V2 query key' using errcode = '23514';
    end if;
    select q.query_snapshot_id into v_existing_id
      from public.analytics_query_snapshots q
      where q.publication_id = v_publication.publication_id and q.query_key = v_key;
    if found then
      select * into strict v_existing_snapshot
        from public.analytics_query_snapshots q where q.query_snapshot_id = v_existing_id;
      if v_existing_snapshot.query_key is distinct from new.query_key
         or v_existing_snapshot.generation_key is distinct from new.generation_key
         or v_existing_snapshot.household_id is distinct from new.household_id
         or v_existing_snapshot.resource is distinct from new.resource
         or v_existing_snapshot.scope_hash is distinct from new.scope_hash
         or v_existing_snapshot.normalized_param_signature is distinct from new.normalized_param_signature
         or v_existing_snapshot.subject_kind is distinct from new.subject_kind
         or v_existing_snapshot.subject_id is distinct from new.subject_id
         or v_existing_snapshot.period_kind is distinct from new.period_kind
         or v_existing_snapshot.period_month is distinct from new.period_month
         or v_existing_snapshot.as_of_month is distinct from new.as_of_month
         or v_existing_snapshot.source_revision is distinct from new.source_revision
         or v_existing_snapshot.analytics_revision is distinct from new.analytics_revision
         or v_existing_snapshot.contract_version is distinct from new.contract_version
         or v_existing_snapshot.method_signature is distinct from new.method_signature
         or v_existing_snapshot.payload is distinct from new.payload
         or v_existing_snapshot.computed_at is distinct from new.computed_at
         or v_existing_snapshot.expires_at is distinct from new.expires_at
         or v_existing_snapshot.publication_id is distinct from new.publication_id
         or v_existing_snapshot.is_active is distinct from new.is_active
         or v_existing_snapshot.invalidated_at is distinct from new.invalidated_at
         or v_existing_snapshot.invalidation_revision is distinct from new.invalidation_revision then
        raise exception 'Global V2 retry changed content' using errcode = '23514';
      end if;
    end if;
  else
    v_key := new.artifact_key;
    if not (v_key = any(v_publication.required_artifact_keys)) then
      raise exception 'Unexpected Global V2 artifact key' using errcode = '23514';
    end if;
    select a.artifact_row_id into v_existing_id
      from public.analytics_artifacts a
      where a.publication_id = v_publication.publication_id and a.artifact_key = v_key;
    if found then
      select * into strict v_existing_artifact
        from public.analytics_artifacts a where a.artifact_row_id = v_existing_id;
      if v_existing_artifact.artifact_key is distinct from new.artifact_key
         or v_existing_artifact.generation_key is distinct from new.generation_key
         or v_existing_artifact.household_id is distinct from new.household_id
         or v_existing_artifact.subject_kind is distinct from new.subject_kind
         or v_existing_artifact.subject_id is distinct from new.subject_id
         or v_existing_artifact.period_kind is distinct from new.period_kind
         or v_existing_artifact.period_month is distinct from new.period_month
         or v_existing_artifact.as_of_month is distinct from new.as_of_month
         or v_existing_artifact.artifact_family is distinct from new.artifact_family
         or v_existing_artifact.metric_id is distinct from new.metric_id
         or v_existing_artifact.dimension_key is distinct from new.dimension_key
         or v_existing_artifact.bucket_key is distinct from new.bucket_key
         or v_existing_artifact.scope_hash is distinct from new.scope_hash
         or v_existing_artifact.filter_signature is distinct from new.filter_signature
         or v_existing_artifact.method_version is distinct from new.method_version
         or v_existing_artifact.contract_version is distinct from new.contract_version
         or v_existing_artifact.source_revision is distinct from new.source_revision
         or v_existing_artifact.analytics_revision is distinct from new.analytics_revision
         or v_existing_artifact.payload is distinct from new.payload
         or v_existing_artifact.computed_at is distinct from new.computed_at
         or v_existing_artifact.publication_id is distinct from new.publication_id
         or v_existing_artifact.is_active is distinct from new.is_active
         or v_existing_artifact.invalidated_at is distinct from new.invalidated_at
         or v_existing_artifact.invalidation_revision is distinct from new.invalidation_revision then
        raise exception 'Global V2 retry changed content' using errcode = '23514';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.guard_history_v2_frozen_content()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_publication public.analytics_publications%rowtype;
  v_existing_artifact public.analytics_artifacts%rowtype;
  v_existing_snapshot public.analytics_query_snapshots%rowtype;
  v_existing_id bigint;
  v_publication_id uuid;
  v_key text;
  v_old_history boolean := false;
  v_new_history boolean := false;
  v_owner boolean := current_user = pg_catalog.pg_get_userbyid((select relowner from pg_catalog.pg_class where oid = tg_relid));
begin
  -- Publication identity is authoritative; scalar markers only provide the
  -- legacy/staging classification and cannot hide a History publication.
  if tg_table_name = 'analytics_query_snapshots' then
    if tg_op <> 'INSERT' then
      v_old_history := (old.contract_version = 'v2' and old.resource like 'history\_%' escape '\')
        or public.is_history_v2_publication(old.publication_id);
    end if;
    if tg_op <> 'DELETE' then
      v_new_history := (new.contract_version = 'v2' and new.resource like 'history\_%' escape '\')
        or public.is_history_v2_publication(new.publication_id);
    end if;
  else
    if tg_op <> 'INSERT' then
      v_old_history := (old.contract_version = 'v2' and old.artifact_family in ('calendar_semantic_month','daily_economic_ledger_month'))
        or public.is_history_v2_publication(old.publication_id);
    end if;
    if tg_op <> 'DELETE' then
      v_new_history := (new.contract_version = 'v2' and new.artifact_family in ('calendar_semantic_month','daily_economic_ledger_month'))
        or public.is_history_v2_publication(new.publication_id);
    end if;
  end if;

  if not coalesce(v_old_history or v_new_history, false) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'INSERT' or not v_old_history then
    v_publication_id := new.publication_id;
  else
    v_publication_id := old.publication_id;
  end if;

  select * into v_publication
    from public.analytics_publications
    where publication_id = v_publication_id
    for update;
  if not found then
    -- Preserve the authorized technical retirement of legacy read-through rows.
    if tg_op = 'UPDATE' and v_owner and old.publication_id is null then
      if tg_table_name = 'analytics_query_snapshots' then
        if old.query_snapshot_id is not distinct from new.query_snapshot_id
           and old.query_key is not distinct from new.query_key
           and old.generation_key is not distinct from new.generation_key
           and old.household_id is not distinct from new.household_id
           and old.resource is not distinct from new.resource
           and old.scope_hash is not distinct from new.scope_hash
           and old.normalized_param_signature is not distinct from new.normalized_param_signature
           and old.subject_kind is not distinct from new.subject_kind
           and old.subject_id is not distinct from new.subject_id
           and old.period_kind is not distinct from new.period_kind
           and old.period_month is not distinct from new.period_month
           and old.as_of_month is not distinct from new.as_of_month
           and old.source_revision is not distinct from new.source_revision
           and old.analytics_revision is not distinct from new.analytics_revision
           and old.contract_version is not distinct from new.contract_version
           and old.method_signature is not distinct from new.method_signature
           and old.payload is not distinct from new.payload
           and old.computed_at is not distinct from new.computed_at
           and old.expires_at is not distinct from new.expires_at
           and old.publication_id is not distinct from new.publication_id
           and not (new.is_active = true and old.is_active = false) then return new; end if;
      else
        if old.artifact_row_id is not distinct from new.artifact_row_id
           and old.artifact_key is not distinct from new.artifact_key
           and old.generation_key is not distinct from new.generation_key
           and old.household_id is not distinct from new.household_id
           and old.subject_kind is not distinct from new.subject_kind
           and old.subject_id is not distinct from new.subject_id
           and old.period_kind is not distinct from new.period_kind
           and old.period_month is not distinct from new.period_month
           and old.as_of_month is not distinct from new.as_of_month
           and old.artifact_family is not distinct from new.artifact_family
           and old.metric_id is not distinct from new.metric_id
           and old.dimension_key is not distinct from new.dimension_key
           and old.bucket_key is not distinct from new.bucket_key
           and old.scope_hash is not distinct from new.scope_hash
           and old.filter_signature is not distinct from new.filter_signature
           and old.method_version is not distinct from new.method_version
           and old.contract_version is not distinct from new.contract_version
           and old.source_revision is not distinct from new.source_revision
           and old.analytics_revision is not distinct from new.analytics_revision
           and old.payload is not distinct from new.payload
           and old.computed_at is not distinct from new.computed_at
           and old.publication_id is not distinct from new.publication_id
           and not (new.is_active = true and old.is_active = false) then return new; end if;
      end if;
    end if;
    raise exception 'History requires a publication; no read-through writes' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then
    raise exception 'History staged/published content cannot be deleted; abandon draft instead' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    if tg_table_name = 'analytics_query_snapshots' then
      if old.query_snapshot_id is distinct from new.query_snapshot_id
         or old.query_key is distinct from new.query_key
         or old.generation_key is distinct from new.generation_key
         or old.household_id is distinct from new.household_id
         or old.resource is distinct from new.resource
         or old.scope_hash is distinct from new.scope_hash
         or old.normalized_param_signature is distinct from new.normalized_param_signature
         or old.subject_kind is distinct from new.subject_kind
         or old.subject_id is distinct from new.subject_id
         or old.period_kind is distinct from new.period_kind
         or old.period_month is distinct from new.period_month
         or old.as_of_month is distinct from new.as_of_month
         or old.source_revision is distinct from new.source_revision
         or old.analytics_revision is distinct from new.analytics_revision
         or old.contract_version is distinct from new.contract_version
         or old.method_signature is distinct from new.method_signature
         or old.payload is distinct from new.payload
         or old.computed_at is distinct from new.computed_at
         or old.expires_at is distinct from new.expires_at
         or old.publication_id is distinct from new.publication_id then
        raise exception 'FROZEN_MONTH: History content is immutable; create a new generation' using errcode = '23514';
      end if;
    else
      if old.artifact_row_id is distinct from new.artifact_row_id
         or old.artifact_key is distinct from new.artifact_key
         or old.generation_key is distinct from new.generation_key
         or old.household_id is distinct from new.household_id
         or old.subject_kind is distinct from new.subject_kind
         or old.subject_id is distinct from new.subject_id
         or old.period_kind is distinct from new.period_kind
         or old.period_month is distinct from new.period_month
         or old.as_of_month is distinct from new.as_of_month
         or old.artifact_family is distinct from new.artifact_family
         or old.metric_id is distinct from new.metric_id
         or old.dimension_key is distinct from new.dimension_key
         or old.bucket_key is distinct from new.bucket_key
         or old.scope_hash is distinct from new.scope_hash
         or old.filter_signature is distinct from new.filter_signature
         or old.method_version is distinct from new.method_version
         or old.contract_version is distinct from new.contract_version
         or old.source_revision is distinct from new.source_revision
         or old.analytics_revision is distinct from new.analytics_revision
         or old.payload is distinct from new.payload
         or old.computed_at is distinct from new.computed_at
         or old.publication_id is distinct from new.publication_id then
        raise exception 'FROZEN_MONTH: History content is immutable; create a new generation' using errcode = '23514';
      end if;
    end if;
    if (old.is_active, old.invalidated_at, old.invalidation_revision) is distinct from
       (new.is_active, new.invalidated_at, new.invalidation_revision) and not v_owner then
      raise exception 'History technical state requires authorized workflow RPC' using errcode = '23514';
    end if;
    return new;
  end if;

  if v_publication.status <> 'draft' or v_publication.published_at is not null
     or v_publication.published_analytics_revision is not null or v_publication.dependency_manifest is not null then
    raise exception 'History stage requires an unsealed, never-published draft' using errcode = '23514';
  end if;
  if new.generation_key is distinct from v_publication.publication_id::text
     or new.household_id is distinct from v_publication.household_id
     or new.period_kind is distinct from 'month'
     or new.period_month is distinct from v_publication.period_month
     or new.source_revision is distinct from v_publication.source_revision
     or new.analytics_revision is distinct from v_publication.base_analytics_revision
     or new.contract_version is distinct from 'v2'
     or new.payload #>> '{publicationMeta,publicationId}' is distinct from v_publication.publication_id::text
     or new.payload #>> '{publicationMeta,revision}' is distinct from (v_publication.base_analytics_revision + 1)::text
     or new.is_active is distinct from false
     or new.invalidated_at is not null or new.invalidation_revision is not null then
    raise exception 'History staging identity/state mismatch' using errcode = '23514';
  end if;

  if tg_table_name = 'analytics_query_snapshots' then
    v_key := new.query_key;
    if not (v_key = any(v_publication.required_query_keys)) then
      raise exception 'Unexpected History query key' using errcode = '23514';
    end if;
    select q.query_snapshot_id into v_existing_id
      from public.analytics_query_snapshots q
      where q.publication_id = v_publication.publication_id and q.query_key = v_key;
    if found then
      select * into strict v_existing_snapshot
        from public.analytics_query_snapshots q where q.query_snapshot_id = v_existing_id;
      if v_existing_snapshot.query_key is distinct from new.query_key
         or v_existing_snapshot.generation_key is distinct from new.generation_key
         or v_existing_snapshot.household_id is distinct from new.household_id
         or v_existing_snapshot.resource is distinct from new.resource
         or v_existing_snapshot.scope_hash is distinct from new.scope_hash
         or v_existing_snapshot.normalized_param_signature is distinct from new.normalized_param_signature
         or v_existing_snapshot.subject_kind is distinct from new.subject_kind
         or v_existing_snapshot.subject_id is distinct from new.subject_id
         or v_existing_snapshot.period_kind is distinct from new.period_kind
         or v_existing_snapshot.period_month is distinct from new.period_month
         or v_existing_snapshot.as_of_month is distinct from new.as_of_month
         or v_existing_snapshot.source_revision is distinct from new.source_revision
         or v_existing_snapshot.analytics_revision is distinct from new.analytics_revision
         or v_existing_snapshot.contract_version is distinct from new.contract_version
         or v_existing_snapshot.method_signature is distinct from new.method_signature
         or v_existing_snapshot.payload is distinct from new.payload
         or v_existing_snapshot.computed_at is distinct from new.computed_at
         or v_existing_snapshot.expires_at is distinct from new.expires_at
         or v_existing_snapshot.publication_id is distinct from new.publication_id
         or v_existing_snapshot.is_active is distinct from new.is_active
         or v_existing_snapshot.invalidated_at is distinct from new.invalidated_at
         or v_existing_snapshot.invalidation_revision is distinct from new.invalidation_revision then
        raise exception 'History retry changed content/identity; create a new generation' using errcode = '23514';
      end if;
    end if;
  else
    v_key := new.artifact_key;
    if not (v_key = any(v_publication.required_artifact_keys)) then
      raise exception 'Unexpected History artifact key' using errcode = '23514';
    end if;
    select a.artifact_row_id into v_existing_id
      from public.analytics_artifacts a
      where a.publication_id = v_publication.publication_id and a.artifact_key = v_key;
    if found then
      select * into strict v_existing_artifact
        from public.analytics_artifacts a where a.artifact_row_id = v_existing_id;
      if v_existing_artifact.artifact_key is distinct from new.artifact_key
         or v_existing_artifact.generation_key is distinct from new.generation_key
         or v_existing_artifact.household_id is distinct from new.household_id
         or v_existing_artifact.subject_kind is distinct from new.subject_kind
         or v_existing_artifact.subject_id is distinct from new.subject_id
         or v_existing_artifact.period_kind is distinct from new.period_kind
         or v_existing_artifact.period_month is distinct from new.period_month
         or v_existing_artifact.as_of_month is distinct from new.as_of_month
         or v_existing_artifact.artifact_family is distinct from new.artifact_family
         or v_existing_artifact.metric_id is distinct from new.metric_id
         or v_existing_artifact.dimension_key is distinct from new.dimension_key
         or v_existing_artifact.bucket_key is distinct from new.bucket_key
         or v_existing_artifact.scope_hash is distinct from new.scope_hash
         or v_existing_artifact.filter_signature is distinct from new.filter_signature
         or v_existing_artifact.method_version is distinct from new.method_version
         or v_existing_artifact.contract_version is distinct from new.contract_version
         or v_existing_artifact.source_revision is distinct from new.source_revision
         or v_existing_artifact.analytics_revision is distinct from new.analytics_revision
         or v_existing_artifact.payload is distinct from new.payload
         or v_existing_artifact.computed_at is distinct from new.computed_at
         or v_existing_artifact.publication_id is distinct from new.publication_id
         or v_existing_artifact.is_active is distinct from new.is_active
         or v_existing_artifact.invalidated_at is distinct from new.invalidated_at
         or v_existing_artifact.invalidation_revision is distinct from new.invalidation_revision then
        raise exception 'History retry changed content/identity; create a new generation' using errcode = '23514';
      end if;
    end if;
  end if;
  return new;
end;
$$;

commit;
