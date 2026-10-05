-- C0: prospective semantic persistence only. No compiler, financial calculation or historical writes.
-- Apply on the remote V2 project only after explicit human validation (AGENTS.md rule 11).

create function private.phase2_month_plan_state_valid_v1(p_state jsonb, p_month date)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare
  v_item jsonb;
  v_value jsonb;
  v_parent text;
  v_seen text[];
  v_uuid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if jsonb_typeof(p_state) is distinct from 'object'
    or p_state->>'version' is distinct from 'month-plan-state@v1'
    or p_state->>'targetMonth' is distinct from to_char(p_month, 'YYYY-MM')
    or p_state - array['version','targetMonth','controls','contexts','preferences'] <> '{}'::jsonb
    or jsonb_typeof(p_state->'controls') is distinct from 'array'
    or jsonb_typeof(p_state->'contexts') is distinct from 'array'
    or jsonb_typeof(p_state->'preferences') is distinct from 'object' then return false; end if;
  if jsonb_array_length(p_state->'controls') > 500 or jsonb_array_length(p_state->'contexts') > 500
    or jsonb_typeof(p_state#>'{preferences,anchors}') is distinct from 'array'
    or jsonb_typeof(p_state#>'{preferences,flexibility}') is distinct from 'object'
    or (p_state->'preferences') - array['anchors','flexibility'] <> '{}'::jsonb then return false; end if;
  if jsonb_array_length(p_state#>'{preferences,anchors}') > 500 then return false; end if;
  for v_item in select value from jsonb_array_elements(p_state->'controls') loop
    if jsonb_typeof(v_item) is distinct from 'object'
      or v_item - array['decisionId','decisionSlotKey','kind','value','provenance'] <> '{}'::jsonb
      or jsonb_typeof(v_item->'decisionId') is distinct from 'string'
      or (v_item->>'decisionId') !~ v_uuid
      or jsonb_typeof(v_item->'decisionSlotKey') is distinct from 'string'
      or length(btrim(v_item->>'decisionSlotKey')) = 0 or length(v_item->>'decisionSlotKey') > 1024
      or v_item->>'kind' is distinct from 'SET_STATE'
      or v_item->>'provenance' is distinct from 'EXPLICIT_USER_DECISION'
      or jsonb_typeof(v_item->'value') is distinct from 'object' then return false; end if;
  end loop;
  if (select count(*) <> count(distinct value->>'decisionSlotKey') or count(*) <> count(distinct value->>'decisionId')
      from jsonb_array_elements(p_state->'controls')) then return false; end if;
  for v_item in select value from jsonb_array_elements(p_state->'contexts') loop
    if jsonb_typeof(v_item) is distinct from 'object'
      or v_item - array['contextOccurrenceId','templateKey','status','parentContextOccurrenceId','fields','slotSelections','provenance'] <> '{}'::jsonb
      or jsonb_typeof(v_item->'contextOccurrenceId') is distinct from 'string'
      or (v_item->>'contextOccurrenceId') !~ v_uuid
      or jsonb_typeof(v_item->'templateKey') is distinct from 'string'
      or length(btrim(v_item->>'templateKey')) = 0 or length(v_item->>'templateKey') > 1024
      or v_item->>'status' is distinct from 'ACTIVE'
      or v_item->>'provenance' is distinct from 'EXPLICIT_USER_DECISION'
      or jsonb_typeof(v_item->'fields') is distinct from 'object'
      or jsonb_typeof(v_item->'slotSelections') is distinct from 'object' then return false; end if;
    if v_item ? 'parentContextOccurrenceId' and v_item->'parentContextOccurrenceId' <> 'null'::jsonb
      and (jsonb_typeof(v_item->'parentContextOccurrenceId') is distinct from 'string'
        or (v_item->>'parentContextOccurrenceId') !~ v_uuid) then return false; end if;
    if exists (select 1 from jsonb_each(v_item->'slotSelections') where jsonb_typeof(value) <> 'object'
      or length(btrim(key)) = 0 or length(key) > 1024) then return false; end if;
  end loop;
  if (select count(*) <> count(distinct value->>'contextOccurrenceId') from jsonb_array_elements(p_state->'contexts')) then return false; end if;
  for v_item in select value from jsonb_array_elements(p_state->'contexts') loop
    v_seen := array[v_item->>'contextOccurrenceId'];
    v_parent := v_item->>'parentContextOccurrenceId';
    while v_parent is not null loop
      if v_parent = any(v_seen) then return false; end if;
      select value into v_value from jsonb_array_elements(p_state->'contexts') where value->>'contextOccurrenceId' = v_parent;
      if not found then return false; end if;
      v_seen := array_append(v_seen, v_parent);
      v_parent := v_value->>'parentContextOccurrenceId';
    end loop;
  end loop;
  if exists (select 1 from jsonb_array_elements(p_state#>'{preferences,anchors}')
      where jsonb_typeof(value) <> 'string' or length(btrim(value#>>'{}')) = 0 or length(value#>>'{}') > 1024)
    or exists (select 1 from jsonb_each(p_state#>'{preferences,flexibility}') where
      length(btrim(key)) = 0 or length(key) > 1024 or jsonb_typeof(value) <> 'string'
      or value#>>'{}' not in ('PRESERVE','NORMAL','WILLING_TO_ADJUST')) then return false; end if;
  return true;
end;
$$;
revoke all on function private.phase2_month_plan_state_valid_v1(jsonb,date) from public, anon, authenticated, service_role;

create table public.phase2_month_plans (
  plan_id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(household_id),
  target_month date not null,
  active_revision_id uuid,
  active_revision_number integer not null default 0,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, target_month),
  unique (plan_id, household_id, target_month),
  constraint phase2_month_plans_first_day check (target_month = date_trunc('month',target_month)::date),
  constraint phase2_month_plans_active check ((active_revision_id is null and active_revision_number = 0)
    or (active_revision_id is not null and active_revision_number > 0))
);

create table public.phase2_month_plan_revisions (
  plan_revision_id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  household_id uuid not null references public.households(household_id),
  target_month date not null,
  revision_number integer not null check (revision_number > 0),
  parent_revision_id uuid,
  apply_request_id uuid not null,
  baseline_digest text not null check (baseline_digest ~ '^[a-f0-9]{64}$'),
  baseline_snapshot jsonb not null check (jsonb_typeof(baseline_snapshot) = 'object'),
  semantic_state jsonb not null,
  semantic_state_digest text not null check (semantic_state_digest ~ '^[a-f0-9]{64}$'),
  change_set jsonb not null check (jsonb_typeof(change_set) = 'array'),
  compiled_manifest jsonb not null check (jsonb_typeof(compiled_manifest) = 'object'),
  compiled_manifest_digest text not null check (compiled_manifest_digest ~ '^[a-f0-9]{64}$'),
  projection_evidence jsonb not null check (jsonb_typeof(projection_evidence) = 'object'),
  preview_digest text not null check (preview_digest ~ '^[a-f0-9]{64}$'),
  compiler_version text not null check (length(btrim(compiler_version)) between 1 and 1024),
  model_versions jsonb not null check (jsonb_typeof(model_versions) = 'object'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (plan_id, revision_number),
  unique (plan_id, apply_request_id),
  unique (plan_id, plan_revision_id),
  unique (plan_id, plan_revision_id, revision_number),
  foreign key (plan_id, household_id, target_month)
    references public.phase2_month_plans(plan_id, household_id, target_month),
  foreign key (plan_id, parent_revision_id)
    references public.phase2_month_plan_revisions(plan_id, plan_revision_id),
  constraint phase2_month_plan_revisions_parent check ((revision_number = 1) = (parent_revision_id is null)),
  constraint phase2_month_plan_revisions_state check (private.phase2_month_plan_state_valid_v1(semantic_state, target_month))
);
alter table public.phase2_month_plans add constraint phase2_month_plans_active_revision_fk
  foreign key (plan_id, active_revision_id, active_revision_number)
  references public.phase2_month_plan_revisions(plan_id, plan_revision_id, revision_number);
create index phase2_month_plan_revisions_household_month_idx on public.phase2_month_plan_revisions(household_id,target_month);
create index phase2_month_plan_revisions_parent_idx on public.phase2_month_plan_revisions(plan_id,parent_revision_id);
create index phase2_month_plans_created_by_idx on public.phase2_month_plans(created_by);
create index phase2_month_plans_updated_by_idx on public.phase2_month_plans(updated_by);
create index phase2_month_plan_revisions_created_by_idx on public.phase2_month_plan_revisions(created_by);

alter table public.phase2_month_plans enable row level security;
alter table public.phase2_month_plan_revisions enable row level security;
revoke all on public.phase2_month_plans, public.phase2_month_plan_revisions from public, anon, authenticated, service_role;
grant select on public.phase2_month_plans, public.phase2_month_plan_revisions to authenticated;
create policy phase2_month_plans_read on public.phase2_month_plans for select to authenticated
  using ((select private.user_has_household_access(household_id)));
create policy phase2_month_plan_revisions_read on public.phase2_month_plan_revisions for select to authenticated
  using ((select private.user_has_household_access(household_id)));

create function private.reject_phase2_month_plan_revision_mutation()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  raise exception using errcode = '55000', message = 'PLANNER_REVISION_IMMUTABLE';
end;
$$;
revoke all on function private.reject_phase2_month_plan_revision_mutation() from public, anon, authenticated, service_role;
create trigger phase2_month_plan_revision_immutable before update or delete on public.phase2_month_plan_revisions
  for each row execute function private.reject_phase2_month_plan_revision_mutation();
create trigger phase2_month_plan_revision_no_truncate before truncate on public.phase2_month_plan_revisions
  for each statement execute function private.reject_phase2_month_plan_revision_mutation();

-- Private definer is necessary: clients have SELECT only, and durable changes must be atomic through Apply.
create function private.apply_phase2_month_plan_v1(
  p_household_id uuid, p_target_month date, p_expected_active_revision_id uuid, p_expected_active_revision_number integer,
  p_apply_request_id uuid, p_baseline_digest text, p_baseline_snapshot jsonb, p_semantic_state jsonb,
  p_semantic_state_digest text, p_change_set jsonb, p_compiled_manifest jsonb, p_compiled_manifest_digest text,
  p_projection_evidence jsonb, p_preview_digest text, p_compiler_version text, p_model_versions jsonb
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_plan public.phase2_month_plans;
  v_revision public.phase2_month_plan_revisions;
begin
  if v_user_id is null or not coalesce(private.user_has_household_access(p_household_id), false) then
    raise exception using errcode = '42501', message = 'PLANNER_HOUSEHOLD_ACCESS_DENIED';
  end if;
  if p_target_month is null or p_target_month <> date_trunc('month', p_target_month)::date
    or p_apply_request_id is null or p_expected_active_revision_number is null or p_expected_active_revision_number < 0
    or ((p_expected_active_revision_id is null) <> (p_expected_active_revision_number = 0))
    or not private.phase2_month_plan_state_valid_v1(p_semantic_state, p_target_month) then
    raise exception using errcode = '22023', message = 'PLANNER_APPLY_PAYLOAD_INVALID';
  end if;
  if jsonb_typeof(p_change_set) is distinct from 'array' or jsonb_typeof(p_model_versions) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'PLANNER_APPLY_PAYLOAD_INVALID';
  end if;
  if jsonb_array_length(p_change_set) > 500
    or exists (select 1 from jsonb_array_elements(p_change_set) where jsonb_typeof(value) <> 'object')
    or exists (select 1 from jsonb_each(p_model_versions) where jsonb_typeof(value) <> 'string'
      or length(btrim(key)) = 0 or length(key) > 1024 or length(btrim(value#>>'{}')) = 0 or length(value#>>'{}') > 1024) then
    raise exception using errcode = '22023', message = 'PLANNER_APPLY_PAYLOAD_INVALID';
  end if;

  insert into public.phase2_month_plans(household_id,target_month,created_by,updated_by)
    values (p_household_id,p_target_month,v_user_id,v_user_id) on conflict (household_id,target_month) do nothing;
  select * into strict v_plan from public.phase2_month_plans
    where household_id = p_household_id and target_month = p_target_month for update;

  -- Serialize both first Apply and subsequent revisions with the same aggregate row lock.
  select * into v_revision from public.phase2_month_plan_revisions
    where plan_id = v_plan.plan_id and apply_request_id = p_apply_request_id;
  if found then
    if v_revision.baseline_digest is distinct from p_baseline_digest or v_revision.baseline_snapshot is distinct from p_baseline_snapshot
      or v_revision.semantic_state is distinct from p_semantic_state or v_revision.semantic_state_digest is distinct from p_semantic_state_digest
      or v_revision.change_set is distinct from p_change_set or v_revision.compiled_manifest is distinct from p_compiled_manifest
      or v_revision.compiled_manifest_digest is distinct from p_compiled_manifest_digest or v_revision.projection_evidence is distinct from p_projection_evidence
      or v_revision.preview_digest is distinct from p_preview_digest or v_revision.compiler_version is distinct from p_compiler_version
      or v_revision.model_versions is distinct from p_model_versions then
      raise exception using errcode = '22023', message = 'PLANNER_IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object('plan',to_jsonb(v_plan),'revision',to_jsonb(v_revision),'replayed',true);
  end if;
  if v_plan.active_revision_id is distinct from p_expected_active_revision_id
    or v_plan.active_revision_number is distinct from p_expected_active_revision_number then
    raise exception using errcode = '40001', message = 'PLANNER_ACTIVE_REVISION_STALE';
  end if;

  insert into public.phase2_month_plan_revisions(plan_id,household_id,target_month,revision_number,parent_revision_id,
    apply_request_id,baseline_digest,baseline_snapshot,semantic_state,semantic_state_digest,change_set,
    compiled_manifest,compiled_manifest_digest,projection_evidence,preview_digest,compiler_version,model_versions,created_by)
  values (v_plan.plan_id,p_household_id,p_target_month,v_plan.active_revision_number + 1,v_plan.active_revision_id,
    p_apply_request_id,p_baseline_digest,p_baseline_snapshot,p_semantic_state,p_semantic_state_digest,p_change_set,
    p_compiled_manifest,p_compiled_manifest_digest,p_projection_evidence,p_preview_digest,p_compiler_version,p_model_versions,v_user_id)
  returning * into v_revision;
  update public.phase2_month_plans set active_revision_id = v_revision.plan_revision_id,
    active_revision_number = v_revision.revision_number, updated_by = v_user_id, updated_at = clock_timestamp()
    where plan_id = v_plan.plan_id returning * into v_plan;
  return jsonb_build_object('plan',to_jsonb(v_plan),'revision',to_jsonb(v_revision),'replayed',false);
end;
$$;
revoke all on function private.apply_phase2_month_plan_v1(uuid,date,uuid,integer,uuid,text,jsonb,jsonb,text,jsonb,jsonb,text,jsonb,text,text,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function private.apply_phase2_month_plan_v1(uuid,date,uuid,integer,uuid,text,jsonb,jsonb,text,jsonb,jsonb,text,jsonb,text,text,jsonb) to authenticated;

-- Exposed RPC remains an invoker; authorization and privileged persistence live in the non-exposed private schema.
create function public.apply_phase2_month_plan_v1(
  p_household_id uuid, p_target_month date, p_expected_active_revision_id uuid, p_expected_active_revision_number integer,
  p_apply_request_id uuid, p_baseline_digest text, p_baseline_snapshot jsonb, p_semantic_state jsonb,
  p_semantic_state_digest text, p_change_set jsonb, p_compiled_manifest jsonb, p_compiled_manifest_digest text,
  p_projection_evidence jsonb, p_preview_digest text, p_compiler_version text, p_model_versions jsonb
)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.apply_phase2_month_plan_v1(p_household_id,p_target_month,p_expected_active_revision_id,
    p_expected_active_revision_number,p_apply_request_id,p_baseline_digest,p_baseline_snapshot,p_semantic_state,
    p_semantic_state_digest,p_change_set,p_compiled_manifest,p_compiled_manifest_digest,p_projection_evidence,
    p_preview_digest,p_compiler_version,p_model_versions);
$$;
revoke all on function public.apply_phase2_month_plan_v1(uuid,date,uuid,integer,uuid,text,jsonb,jsonb,text,jsonb,jsonb,text,jsonb,text,text,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.apply_phase2_month_plan_v1(uuid,date,uuid,integer,uuid,text,jsonb,jsonb,text,jsonb,jsonb,text,jsonb,text,text,jsonb) to authenticated;
comment on function public.apply_phase2_month_plan_v1(uuid,date,uuid,integer,uuid,text,jsonb,jsonb,text,jsonb,jsonb,text,jsonb,text,text,jsonb)
  is 'Planner semantic append/CAS/idempotence only. C2 server must re-read authorities and validate preview before invoking.';
