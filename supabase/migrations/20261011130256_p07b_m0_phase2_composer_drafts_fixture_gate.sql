set local lock_timeout = '5s';
-- P07-B: candidate for explicit review on Budgetisation main. DO NOT EXECUTE NOW.
-- Submit as one versioned, atomic migration only after a verified logical backup
-- and separate approval. The migration runner's transaction behavior is a gate.
-- This creates no fixtures and does not touch Plan, financial, mobility or wallet rows.
-- Test-only gate: exactly two reserved fixture households and an admin-owned Auth tag.

do $preflight$
begin
  if current_user <> 'postgres'
    or to_regclass('public.phase2_composer_drafts') is not null
    or to_regclass('public.phase2_month_plans') is null
    or to_regclass('public.phase2_month_plan_revisions') is null
    or to_regprocedure('private.phase2_month_plan_state_valid_v1(jsonb,date)') is null
    or to_regprocedure('private.user_has_household_access(uuid)') is null
    or to_regprocedure('private.phase2_composer_test_actor_v1()') is not null
    or to_regprocedure('private.save_phase2_composer_draft_v1(uuid,date,uuid,integer,uuid,uuid,uuid,integer,jsonb,text)') is not null
    or to_regprocedure('private.archive_phase2_composer_draft_v1(uuid,date,uuid,integer,uuid)') is not null
    or to_regprocedure('private.restore_phase2_composer_draft_v1(uuid,date,uuid,integer,uuid)') is not null
    or to_regprocedure('public.save_phase2_composer_draft_v1(uuid,date,uuid,integer,uuid,uuid,uuid,integer,jsonb,text)') is not null
    or to_regprocedure('public.archive_phase2_composer_draft_v1(uuid,date,uuid,integer,uuid)') is not null
    or to_regprocedure('public.restore_phase2_composer_draft_v1(uuid,date,uuid,integer,uuid)') is not null then
    raise exception 'P07B_PREFLIGHT_SCHEMA_CHANGED';
  end if;
  if not has_function_privilege('authenticated', 'private.user_has_household_access(uuid)', 'EXECUTE')
    or not has_schema_privilege('authenticated', 'private', 'USAGE')
    or (select pg_get_userbyid(proowner) <> 'postgres' or not prosecdef
          or not coalesce('search_path=""' = any(proconfig), false)
        from pg_proc where oid = 'private.user_has_household_access(uuid)'::regprocedure)
    or (select pg_get_userbyid(proowner) <> 'postgres' or prosecdef
          or not coalesce('search_path=""' = any(proconfig), false)
        from pg_proc where oid = 'private.phase2_month_plan_state_valid_v1(jsonb,date)'::regprocedure)
    or exists (select 1 from public.households where household_id in (
      'f07b0000-0000-4000-8000-000000000001'::uuid,
      'f07b0000-0000-4000-8000-000000000002'::uuid))
    or exists (select 1 from auth.users
      where raw_app_meta_data->>'composer_draft_test' = 'p07b-20261010') then
    raise exception 'P07B_PREFLIGHT_AUTH_OR_FIXTURE_CHANGED';
  end if;
end;
$preflight$;

-- Admin-controlled app_metadata is the temporary write gate. User metadata is never used.
create function private.phase2_composer_test_actor_v1()
returns boolean language sql stable security definer set search_path = '' as $fn$
  select exists (
    select 1 from auth.users u
    where u.id = (select auth.uid())
      and u.raw_app_meta_data->>'composer_draft_test' = 'p07b-20261010'
  );
$fn$;
revoke all on function private.phase2_composer_test_actor_v1()
  from public, anon, authenticated, service_role;
grant execute on function private.phase2_composer_test_actor_v1() to authenticated;

create table public.phase2_composer_drafts (
  draft_id uuid primary key default pg_catalog.gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  household_id uuid not null references public.households(household_id) on delete restrict,
  target_month date not null,
  lifecycle text not null default 'ACTIVE' check (lifecycle in ('ACTIVE','ABANDONED')),
  draft_schema_version text not null default 'composer-draft@v1'
    check (draft_schema_version = 'composer-draft@v1'),
  draft_version integer not null default 1 check (draft_version > 0),
  base_plan_id uuid,
  base_plan_revision_id uuid,
  base_plan_revision_number integer not null default 0 check (base_plan_revision_number >= 0),
  semantic_state jsonb not null,
  semantic_state_digest text not null check (semantic_state_digest ~ '^[a-f0-9]{64}$'),
  last_mutation_request_id uuid not null,
  last_mutation_expected_version integer not null check (last_mutation_expected_version >= 0),
  last_mutation_kind text not null check (last_mutation_kind in ('SAVE','ARCHIVE','RESTORE')),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  last_saved_at timestamptz not null default pg_catalog.clock_timestamp(),
  retention_review_at timestamptz not null,
  archived_at timestamptz,
  constraint phase2_composer_drafts_month_first_day
    check (target_month = date_trunc('month', target_month)::date),
  constraint phase2_composer_drafts_lifecycle
    check ((lifecycle = 'ACTIVE' and archived_at is null)
      or (lifecycle = 'ABANDONED' and archived_at is not null)),
  constraint phase2_composer_drafts_base_pair
    check ((base_plan_id is null and base_plan_revision_id is null and base_plan_revision_number = 0)
      or (base_plan_id is not null and base_plan_revision_id is not null and base_plan_revision_number > 0)),
  constraint phase2_composer_drafts_base_plan_scope
    foreign key (base_plan_id, household_id, target_month)
    references public.phase2_month_plans(plan_id, household_id, target_month),
  constraint phase2_composer_drafts_base_revision_scope
    foreign key (base_plan_id, base_plan_revision_id, base_plan_revision_number)
    references public.phase2_month_plan_revisions(plan_id, plan_revision_id, revision_number),
  constraint phase2_composer_drafts_state
    check (private.phase2_month_plan_state_valid_v1(semantic_state, target_month)),
  constraint phase2_composer_drafts_size
    check (octet_length(semantic_state::text) <= 1048576),
  constraint phase2_composer_drafts_retention
    check (retention_review_at > last_saved_at)
);

-- One ACTIVE Draft per author/household/month. ABANDONED rows remain recoverable.
create unique index phase2_composer_drafts_one_active_per_author_month
  on public.phase2_composer_drafts(owner_user_id, household_id, target_month)
  where lifecycle = 'ACTIVE';
create index phase2_composer_drafts_author_month_recovery_idx
  on public.phase2_composer_drafts(owner_user_id, household_id, target_month, created_at desc);
create index phase2_composer_drafts_household_idx
  on public.phase2_composer_drafts(household_id);

alter table public.phase2_composer_drafts enable row level security;
revoke all on public.phase2_composer_drafts from public, anon, authenticated, service_role;
grant select on public.phase2_composer_drafts to authenticated;
create policy phase2_composer_drafts_fixture_author_read
  on public.phase2_composer_drafts for select to authenticated
  using (owner_user_id = (select auth.uid())
    and household_id in (
      'f07b0000-0000-4000-8000-000000000001'::uuid,
      'f07b0000-0000-4000-8000-000000000002'::uuid)
    and (select private.phase2_composer_test_actor_v1())
    and (select private.user_has_household_access(household_id)));

create function private.save_phase2_composer_draft_v1(
  p_household_id uuid, p_target_month date, p_expected_draft_id uuid,
  p_expected_draft_version integer, p_save_request_id uuid,
  p_base_plan_id uuid, p_base_plan_revision_id uuid, p_base_plan_revision_number integer,
  p_semantic_state jsonb, p_semantic_state_digest text
)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  v_user_id uuid := auth.uid();
  v_draft public.phase2_composer_drafts;
  v_plan public.phase2_month_plans;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if v_user_id is null
    or p_household_id not in (
      'f07b0000-0000-4000-8000-000000000001'::uuid,
      'f07b0000-0000-4000-8000-000000000002'::uuid)
    or not coalesce(private.phase2_composer_test_actor_v1(), false)
    or not coalesce(private.user_has_household_access(p_household_id), false) then
    raise exception using errcode = '42501', message = 'COMPOSER_DRAFT_ACCESS_DENIED';
  end if;
  if p_target_month is null or p_target_month <> date_trunc('month', p_target_month)::date
    or p_save_request_id is null or p_expected_draft_version is null or p_expected_draft_version < 0
    or ((p_expected_draft_id is null) <> (p_expected_draft_version = 0))
    or p_base_plan_revision_number is null or p_base_plan_revision_number < 0
    or not ((p_base_plan_id is null and p_base_plan_revision_id is null and p_base_plan_revision_number = 0)
      or (p_base_plan_id is not null and p_base_plan_revision_id is not null and p_base_plan_revision_number > 0))
    or p_semantic_state_digest is null or p_semantic_state_digest !~ '^[a-f0-9]{64}$'
    or not coalesce(private.phase2_month_plan_state_valid_v1(p_semantic_state, p_target_month), false)
    or octet_length(p_semantic_state::text) > 1048576 then
    raise exception using errcode = '22023', message = 'COMPOSER_DRAFT_PAYLOAD_INVALID_OR_TOO_LARGE';
  end if;

  if p_expected_draft_version = 0 then
    select * into v_draft from public.phase2_composer_drafts
      where owner_user_id = v_user_id and household_id = p_household_id
        and target_month = p_target_month and lifecycle = 'ACTIVE' for update;
    if found then
      if v_draft.last_mutation_request_id = p_save_request_id
        and v_draft.last_mutation_kind = 'SAVE'
        and v_draft.last_mutation_expected_version = 0
        and v_draft.base_plan_id is not distinct from p_base_plan_id
        and v_draft.base_plan_revision_id is not distinct from p_base_plan_revision_id
        and v_draft.base_plan_revision_number = p_base_plan_revision_number
        and v_draft.semantic_state = p_semantic_state
        and v_draft.semantic_state_digest = p_semantic_state_digest then
        return jsonb_build_object('draft', to_jsonb(v_draft), 'replayed', true);
      end if;
      raise exception using errcode = '40001', message = 'COMPOSER_DRAFT_CREATE_CONFLICT';
    end if;

    select * into v_plan from public.phase2_month_plans
      where household_id = p_household_id and target_month = p_target_month;
    if p_base_plan_id is distinct from
        (case when v_plan.active_revision_id is null then null else v_plan.plan_id end)
      or p_base_plan_revision_id is distinct from v_plan.active_revision_id
      or p_base_plan_revision_number <> coalesce(v_plan.active_revision_number, 0) then
      raise exception using errcode = '40001', message = 'COMPOSER_DRAFT_BASE_STALE';
    end if;
    insert into public.phase2_composer_drafts (
      owner_user_id, household_id, target_month, base_plan_id, base_plan_revision_id,
      base_plan_revision_number, semantic_state, semantic_state_digest,
      last_mutation_request_id, last_mutation_expected_version, last_mutation_kind,
      created_at, last_saved_at, retention_review_at
    ) values (
      v_user_id, p_household_id, p_target_month, p_base_plan_id, p_base_plan_revision_id,
      p_base_plan_revision_number, p_semantic_state, p_semantic_state_digest,
      p_save_request_id, 0, 'SAVE', v_now, v_now, v_now + interval '365 days'
    ) on conflict (owner_user_id, household_id, target_month)
      where lifecycle = 'ACTIVE' do nothing returning * into v_draft;
    if found then
      return jsonb_build_object('draft', to_jsonb(v_draft), 'replayed', false);
    end if;
    select * into v_draft from public.phase2_composer_drafts
      where owner_user_id = v_user_id and household_id = p_household_id
        and target_month = p_target_month and lifecycle = 'ACTIVE' for update;
    if found and v_draft.last_mutation_request_id = p_save_request_id
      and v_draft.last_mutation_kind = 'SAVE'
      and v_draft.last_mutation_expected_version = 0
      and v_draft.base_plan_id is not distinct from p_base_plan_id
      and v_draft.base_plan_revision_id is not distinct from p_base_plan_revision_id
      and v_draft.base_plan_revision_number = p_base_plan_revision_number
      and v_draft.semantic_state = p_semantic_state
      and v_draft.semantic_state_digest = p_semantic_state_digest then
      return jsonb_build_object('draft', to_jsonb(v_draft), 'replayed', true);
    end if;
    raise exception using errcode = '40001', message = 'COMPOSER_DRAFT_CREATE_CONFLICT';
  end if;

  select * into v_draft from public.phase2_composer_drafts
    where draft_id = p_expected_draft_id and owner_user_id = v_user_id
      and household_id = p_household_id and target_month = p_target_month
      and lifecycle = 'ACTIVE' for update;
  if not found then
    raise exception using errcode = '40001', message = 'COMPOSER_DRAFT_NOT_CURRENT';
  end if;
  if v_draft.last_mutation_request_id = p_save_request_id then
    if v_draft.last_mutation_kind = 'SAVE'
      and v_draft.last_mutation_expected_version = p_expected_draft_version
      and v_draft.base_plan_id is not distinct from p_base_plan_id
      and v_draft.base_plan_revision_id is not distinct from p_base_plan_revision_id
      and v_draft.base_plan_revision_number = p_base_plan_revision_number
      and v_draft.semantic_state = p_semantic_state
      and v_draft.semantic_state_digest = p_semantic_state_digest then
      return jsonb_build_object('draft', to_jsonb(v_draft), 'replayed', true);
    end if;
    raise exception using errcode = '22023', message = 'COMPOSER_DRAFT_REQUEST_REUSED';
  end if;
  if v_draft.draft_version <> p_expected_draft_version
    or v_draft.base_plan_id is distinct from p_base_plan_id
    or v_draft.base_plan_revision_id is distinct from p_base_plan_revision_id
    or v_draft.base_plan_revision_number <> p_base_plan_revision_number then
    raise exception using errcode = '40001', message = 'COMPOSER_DRAFT_VERSION_STALE';
  end if;
  update public.phase2_composer_drafts set
    semantic_state = p_semantic_state, semantic_state_digest = p_semantic_state_digest,
    draft_version = draft_version + 1,
    last_mutation_request_id = p_save_request_id,
    last_mutation_expected_version = p_expected_draft_version,
    last_mutation_kind = 'SAVE',
    last_saved_at = v_now, retention_review_at = v_now + interval '365 days'
    where draft_id = v_draft.draft_id returning * into v_draft;
  return jsonb_build_object('draft', to_jsonb(v_draft), 'replayed', false);
end;
$fn$;
revoke all on function private.save_phase2_composer_draft_v1(uuid,date,uuid,integer,uuid,uuid,uuid,integer,jsonb,text)
  from public, anon, authenticated, service_role;
grant execute on function private.save_phase2_composer_draft_v1(uuid,date,uuid,integer,uuid,uuid,uuid,integer,jsonb,text)
  to authenticated;

create function public.save_phase2_composer_draft_v1(
  p_household_id uuid, p_target_month date, p_expected_draft_id uuid,
  p_expected_draft_version integer, p_save_request_id uuid,
  p_base_plan_id uuid, p_base_plan_revision_id uuid, p_base_plan_revision_number integer,
  p_semantic_state jsonb, p_semantic_state_digest text
)
returns jsonb language sql security invoker set search_path = '' as $fn$
  select private.save_phase2_composer_draft_v1(
    p_household_id, p_target_month, p_expected_draft_id, p_expected_draft_version,
    p_save_request_id, p_base_plan_id, p_base_plan_revision_id,
    p_base_plan_revision_number, p_semantic_state, p_semantic_state_digest);
$fn$;
revoke all on function public.save_phase2_composer_draft_v1(uuid,date,uuid,integer,uuid,uuid,uuid,integer,jsonb,text)
  from public, anon, authenticated, service_role;
grant execute on function public.save_phase2_composer_draft_v1(uuid,date,uuid,integer,uuid,uuid,uuid,integer,jsonb,text)
  to authenticated;

-- Logical abandon preserves the payload and permits explicit recovery; no DELETE RPC.
create function private.archive_phase2_composer_draft_v1(
  p_household_id uuid, p_target_month date, p_draft_id uuid,
  p_expected_draft_version integer, p_archive_request_id uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  v_user_id uuid := auth.uid();
  v_draft public.phase2_composer_drafts;
begin
  if v_user_id is null
    or p_household_id not in (
      'f07b0000-0000-4000-8000-000000000001'::uuid,
      'f07b0000-0000-4000-8000-000000000002'::uuid)
    or not coalesce(private.phase2_composer_test_actor_v1(), false)
    or not coalesce(private.user_has_household_access(p_household_id), false) then
    raise exception using errcode = '42501', message = 'COMPOSER_DRAFT_ACCESS_DENIED';
  end if;
  if p_target_month is null or p_target_month <> date_trunc('month', p_target_month)::date
    or p_draft_id is null or p_archive_request_id is null
    or p_expected_draft_version is null or p_expected_draft_version < 1 then
    raise exception using errcode = '22023', message = 'COMPOSER_DRAFT_ARCHIVE_INVALID';
  end if;
  select * into v_draft from public.phase2_composer_drafts
    where draft_id = p_draft_id and owner_user_id = v_user_id
      and household_id = p_household_id and target_month = p_target_month for update;
  if not found then
    raise exception using errcode = '40001', message = 'COMPOSER_DRAFT_NOT_CURRENT';
  end if;
  if v_draft.last_mutation_request_id = p_archive_request_id then
    if v_draft.last_mutation_kind = 'ARCHIVE'
      and v_draft.last_mutation_expected_version = p_expected_draft_version
      and v_draft.lifecycle = 'ABANDONED' then
      return jsonb_build_object('draft', to_jsonb(v_draft), 'replayed', true);
    end if;
    raise exception using errcode = '22023', message = 'COMPOSER_DRAFT_REQUEST_REUSED';
  end if;
  if v_draft.lifecycle <> 'ACTIVE' or v_draft.draft_version <> p_expected_draft_version then
    raise exception using errcode = '40001', message = 'COMPOSER_DRAFT_VERSION_STALE';
  end if;
  update public.phase2_composer_drafts set
    lifecycle = 'ABANDONED', archived_at = pg_catalog.clock_timestamp(),
    draft_version = draft_version + 1,
    last_mutation_request_id = p_archive_request_id,
    last_mutation_expected_version = p_expected_draft_version,
    last_mutation_kind = 'ARCHIVE'
    where draft_id = p_draft_id returning * into v_draft;
  return jsonb_build_object('draft', to_jsonb(v_draft), 'replayed', false);
end;
$fn$;
revoke all on function private.archive_phase2_composer_draft_v1(uuid,date,uuid,integer,uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.archive_phase2_composer_draft_v1(uuid,date,uuid,integer,uuid)
  to authenticated;

create function public.archive_phase2_composer_draft_v1(
  p_household_id uuid, p_target_month date, p_draft_id uuid,
  p_expected_draft_version integer, p_archive_request_id uuid
)
returns jsonb language sql security invoker set search_path = '' as $fn$
  select private.archive_phase2_composer_draft_v1(
    p_household_id, p_target_month, p_draft_id,
    p_expected_draft_version, p_archive_request_id);
$fn$;
revoke all on function public.archive_phase2_composer_draft_v1(uuid,date,uuid,integer,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.archive_phase2_composer_draft_v1(uuid,date,uuid,integer,uuid)
  to authenticated;

-- Recovery never replaces an ACTIVE Draft. The caller must explicitly archive
-- any current ACTIVE Draft with its own CAS request, then retry this operation.
create function private.restore_phase2_composer_draft_v1(
  p_household_id uuid, p_target_month date, p_draft_id uuid,
  p_expected_draft_version integer, p_restore_request_id uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  v_user_id uuid := auth.uid();
  v_draft public.phase2_composer_drafts;
begin
  if v_user_id is null
    or p_household_id not in (
      'f07b0000-0000-4000-8000-000000000001'::uuid,
      'f07b0000-0000-4000-8000-000000000002'::uuid)
    or not coalesce(private.phase2_composer_test_actor_v1(), false)
    or not coalesce(private.user_has_household_access(p_household_id), false) then
    raise exception using errcode = '42501', message = 'COMPOSER_DRAFT_ACCESS_DENIED';
  end if;
  if p_target_month is null or p_target_month <> date_trunc('month', p_target_month)::date
    or p_draft_id is null or p_restore_request_id is null
    or p_expected_draft_version is null or p_expected_draft_version < 1 then
    raise exception using errcode = '22023', message = 'COMPOSER_DRAFT_RESTORE_INVALID';
  end if;
  select * into v_draft from public.phase2_composer_drafts
    where draft_id = p_draft_id and owner_user_id = v_user_id
      and household_id = p_household_id and target_month = p_target_month for update;
  if not found then
    raise exception using errcode = '40001', message = 'COMPOSER_DRAFT_NOT_CURRENT';
  end if;
  if v_draft.last_mutation_request_id = p_restore_request_id then
    if v_draft.last_mutation_kind = 'RESTORE'
      and v_draft.last_mutation_expected_version = p_expected_draft_version
      and v_draft.lifecycle = 'ACTIVE' then
      return jsonb_build_object('draft', to_jsonb(v_draft), 'replayed', true);
    end if;
    raise exception using errcode = '22023', message = 'COMPOSER_DRAFT_REQUEST_REUSED';
  end if;
  if v_draft.lifecycle <> 'ABANDONED' or v_draft.draft_version <> p_expected_draft_version then
    raise exception using errcode = '40001', message = 'COMPOSER_DRAFT_VERSION_STALE';
  end if;
  if exists (select 1 from public.phase2_composer_drafts
      where owner_user_id = v_user_id and household_id = p_household_id
        and target_month = p_target_month and lifecycle = 'ACTIVE') then
    raise exception using errcode = '40001', message = 'COMPOSER_DRAFT_ACTIVE_EXISTS';
  end if;
  begin
    update public.phase2_composer_drafts set
      lifecycle = 'ACTIVE', archived_at = null,
      draft_version = draft_version + 1,
      last_mutation_request_id = p_restore_request_id,
      last_mutation_expected_version = p_expected_draft_version,
      last_mutation_kind = 'RESTORE'
      where draft_id = p_draft_id returning * into v_draft;
  exception when unique_violation then
    raise exception using errcode = '40001', message = 'COMPOSER_DRAFT_ACTIVE_EXISTS';
  end;
  return jsonb_build_object('draft', to_jsonb(v_draft), 'replayed', false);
end;
$fn$;
revoke all on function private.restore_phase2_composer_draft_v1(uuid,date,uuid,integer,uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.restore_phase2_composer_draft_v1(uuid,date,uuid,integer,uuid)
  to authenticated;

create function public.restore_phase2_composer_draft_v1(
  p_household_id uuid, p_target_month date, p_draft_id uuid,
  p_expected_draft_version integer, p_restore_request_id uuid
)
returns jsonb language sql security invoker set search_path = '' as $fn$
  select private.restore_phase2_composer_draft_v1(
    p_household_id, p_target_month, p_draft_id,
    p_expected_draft_version, p_restore_request_id);
$fn$;
revoke all on function public.restore_phase2_composer_draft_v1(uuid,date,uuid,integer,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.restore_phase2_composer_draft_v1(uuid,date,uuid,integer,uuid)
  to authenticated;

comment on table public.phase2_composer_drafts is
  'P07-B test-gated semantic drafts. No financial Apply, no automatic purge.';
comment on function public.save_phase2_composer_draft_v1(uuid,date,uuid,integer,uuid,uuid,uuid,integer,jsonb,text) is
  'P07-B test-gated CAS save; canonical TypeScript digest is verified by the server before calling and after reading.';

