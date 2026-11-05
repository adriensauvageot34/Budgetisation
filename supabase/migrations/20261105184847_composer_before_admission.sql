-- Before admission: server-only writer; no LOGIN, password, client flag or remote provisioning.
-- Requires migration role CREATEROLE and ownership of existing private functions/table.
-- Compatibility promotion is monotone; legacy rollback must keep this SQL fence installed.
begin;
lock table public.phase2_composer_drafts in access exclusive mode;

 create role composer_before_owner nologin noinherit nobypassrls;create role composer_before_executor nologin noinherit nobypassrls;
 alter table public.phase2_composer_drafts add column last_admission_fingerprint text, add column before_admission_required boolean not null default false;
 create table private.composer_before_scopes(owner_user_id uuid,household_id uuid,target_month date,required boolean not null default false,primary key(owner_user_id,household_id,target_month));
 alter table private.composer_before_scopes enable row level security;revoke all on private.composer_before_scopes from public,anon,authenticated,service_role;
 create function private.composer_before_reserved(s jsonb) returns boolean language sql immutable set search_path='' as $b$ select exists(select 1 from jsonb_array_elements(coalesce(s->'contexts','[]')) c where c->'fields' ? 'beforeMoment' or c#>>'{fields,fieldSchemaVersion}'='context-fields@v7') $b$;
 revoke all on function private.composer_before_reserved(jsonb) from public,anon,authenticated,service_role;grant execute on function private.composer_before_reserved(jsonb) to composer_before_owner;
 create function private.composer_before_scopes_lock(u uuid,h uuid,m date) returns boolean language plpgsql security definer set search_path='' as $b$ declare r boolean;begin
 if u is null or h is null or m is null then raise exception using errcode='22023',message='ADMISSION_SCOPE_INVALID';end if;
 insert into private.composer_before_scopes values(u,h,m,false) on conflict do nothing;
 select required into r from private.composer_before_scopes where owner_user_id=u and household_id=h and target_month=m for update;
 if not found then raise exception using errcode='40001',message='ADMISSION_SCOPE_NOT_VISIBLE';end if;
 if not r and exists(select 1 from public.phase2_composer_drafts d where d.owner_user_id=u and d.household_id=h and d.target_month=m and private.composer_before_reserved(d.semantic_state)) then update private.composer_before_scopes set required=true where owner_user_id=u and household_id=h and target_month=m;r:=true;end if;return r;end;$b$;
 revoke all on function private.composer_before_scopes_lock(uuid,uuid,date) from public,anon,authenticated,service_role;grant execute on function private.composer_before_scopes_lock(uuid,uuid,date) to composer_before_owner;

-- Seed existing marked scopes before the trigger. No financial tables are written.
 insert into private.composer_before_scopes select distinct owner_user_id,household_id,target_month,true
 from public.phase2_composer_drafts where private.composer_before_reserved(semantic_state);
 update public.phase2_composer_drafts set before_admission_required=true where private.composer_before_reserved(semantic_state);
 create function private.composer_before_fence() returns trigger language plpgsql security invoker set search_path='' as $b$ declare protected boolean;begin
 if TG_OP='DELETE' then raise exception using errcode='55000',message='ADMISSION_DELETE_FORBIDDEN';end if;
 if TG_OP='UPDATE' and (new.owner_user_id is distinct from old.owner_user_id or new.household_id is distinct from old.household_id or new.target_month is distinct from old.target_month) then raise exception using errcode='55000',message='ADMISSION_SCOPE_IMMUTABLE';end if;
 protected:=private.composer_before_scopes_lock(new.owner_user_id,new.household_id,new.target_month) or private.composer_before_reserved(new.semantic_state);
 if TG_OP='UPDATE' and old.before_admission_required then protected:=true;end if;
 if protected or new.before_admission_required then
 new.before_admission_required:=true;
 if current_user<>'composer_before_owner' then raise exception using errcode='55000',message='BEFORE_COMPATIBILITY_REQUIRED';end if;
 update private.composer_before_scopes set required=true where owner_user_id=new.owner_user_id and household_id=new.household_id and target_month=new.target_month;
 end if;return new;end;$b$;
 revoke all on function private.composer_before_fence() from public,anon,authenticated,service_role;grant execute on function private.composer_before_fence() to composer_before_owner;
 create trigger composer_before_fence before insert or update or delete on public.phase2_composer_drafts for each row execute function private.composer_before_fence();
 grant usage on schema public,private,auth to composer_before_owner,composer_before_executor;
 grant select,insert,update on public.phase2_composer_drafts to composer_before_owner;grant select on public.phase2_month_plans to composer_before_owner;grant update(active_revision_number) on public.phase2_month_plans to composer_before_owner;grant select,insert,update on private.composer_before_scopes to composer_before_owner;
 grant execute on function auth.uid(),private.phase2_composer_draft_access_allowed_v2(),private.user_has_household_access(uuid),private.phase2_month_plan_state_valid_v1(jsonb,date) to composer_before_owner;
 create policy composer_before_owner_read on public.phase2_composer_drafts for select to composer_before_owner using(owner_user_id=auth.uid() and private.phase2_composer_draft_access_allowed_v2() and private.user_has_household_access(household_id));
 create policy composer_before_owner_insert on public.phase2_composer_drafts for insert to composer_before_owner with check(owner_user_id=auth.uid() and private.phase2_composer_draft_access_allowed_v2() and private.user_has_household_access(household_id));
 create policy composer_before_owner_update on public.phase2_composer_drafts for update to composer_before_owner using(owner_user_id=auth.uid() and private.phase2_composer_draft_access_allowed_v2() and private.user_has_household_access(household_id)) with check(owner_user_id=auth.uid() and private.phase2_composer_draft_access_allowed_v2() and private.user_has_household_access(household_id));
 create policy composer_before_owner_base on public.phase2_month_plans for select to composer_before_owner using(private.user_has_household_access(household_id));
 create policy composer_before_owner_base_lock on public.phase2_month_plans for update to composer_before_owner using(private.user_has_household_access(household_id)) with check(false);
 create policy composer_before_scopes_policy on private.composer_before_scopes to composer_before_owner using(owner_user_id=auth.uid() and private.phase2_composer_draft_access_allowed_v2() and private.user_has_household_access(household_id)) with check(owner_user_id=auth.uid() and private.phase2_composer_draft_access_allowed_v2() and private.user_has_household_access(household_id));
 CREATE OR REPLACE FUNCTION private.save_composer_before_draft_v1(p_household_id uuid, p_target_month date, p_expected_draft_id uuid, p_expected_draft_version integer, p_save_request_id uuid, p_base_plan_id uuid, p_base_plan_revision_id uuid, p_base_plan_revision_number integer, p_semantic_state jsonb, p_semantic_state_digest text, p_verified_actor uuid, p_expected_state_digest text, p_admission_fingerprint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_draft public.phase2_composer_drafts;
  v_plan public.phase2_month_plans;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
if p_expected_state_digest is null
 or p_expected_state_digest!~'^[a-f0-9]{64}$' or p_admission_fingerprint is null or p_admission_fingerprint!~'^[a-f0-9]{64}$'
 then raise exception using errcode='22023',message='BEFORE_ADMISSION_BASE_OR_FINGERPRINT_INVALID';end if;
v_user_id:=p_verified_actor; perform set_config('request.jwt.claim.sub',p_verified_actor::text,true);
  if v_user_id is null
    or not coalesce(private.phase2_composer_draft_access_allowed_v2(), false)
    or not coalesce(private.user_has_household_access(p_household_id), false) then
    raise exception using errcode = '42501', message = 'COMPOSER_DRAFT_ACCESS_DENIED';
  end if;
  perform private.composer_before_scopes_lock(v_user_id,p_household_id,p_target_month);
 select * into v_draft from public.phase2_composer_drafts where owner_user_id=v_user_id and household_id=p_household_id and target_month=p_target_month and lifecycle='ACTIVE';
 if v_draft.last_mutation_request_id=p_save_request_id then
 if v_draft.last_admission_fingerprint is distinct from p_admission_fingerprint then raise exception using errcode='22023',message='ADMISSION_REQUEST_REUSED';end if;
 elsif p_expected_draft_version=0 then
 if v_draft.draft_id is not null then raise exception using errcode='40001',message='ADMISSION_CREATE_CONFLICT';end if;
 elsif v_draft.semantic_state_digest is distinct from p_expected_state_digest then raise exception using errcode='40001',message='ADMISSION_BASE_CHANGED';end if;
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
      where household_id = p_household_id and target_month = p_target_month for share;
    if p_base_plan_id is distinct from
        (case when v_plan.active_revision_id is null then null else v_plan.plan_id end)
      or p_base_plan_revision_id is distinct from v_plan.active_revision_id
      or p_base_plan_revision_number <> coalesce(v_plan.active_revision_number, 0) then
      raise exception using errcode = '40001', message = 'COMPOSER_DRAFT_BASE_STALE';
    end if;
    insert into public.phase2_composer_drafts (
      owner_user_id, household_id, target_month, base_plan_id, base_plan_revision_id,
      base_plan_revision_number, semantic_state,semantic_state_digest,last_admission_fingerprint,before_admission_required,
      last_mutation_request_id, last_mutation_expected_version, last_mutation_kind,
      created_at, last_saved_at, retention_review_at
    ) values (
      v_user_id, p_household_id, p_target_month, p_base_plan_id, p_base_plan_revision_id,
      p_base_plan_revision_number, p_semantic_state,p_semantic_state_digest,p_admission_fingerprint,true,
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
  select * into v_plan from public.phase2_month_plans
    where household_id = p_household_id and target_month = p_target_month for share;
  if p_base_plan_id is distinct from
      (case when v_plan.active_revision_id is null then null else v_plan.plan_id end)
    or p_base_plan_revision_id is distinct from v_plan.active_revision_id
    or p_base_plan_revision_number <> coalesce(v_plan.active_revision_number, 0) then
    raise exception using errcode = '40001', message = 'COMPOSER_DRAFT_BASE_STALE';
  end if;
  if v_draft.draft_version <> p_expected_draft_version
    or v_draft.base_plan_id is distinct from p_base_plan_id
    or v_draft.base_plan_revision_id is distinct from p_base_plan_revision_id
    or v_draft.base_plan_revision_number <> p_base_plan_revision_number then
    raise exception using errcode = '40001', message = 'COMPOSER_DRAFT_VERSION_STALE';
  end if;
  update public.phase2_composer_drafts set
    semantic_state = p_semantic_state, semantic_state_digest = p_semantic_state_digest,last_admission_fingerprint=p_admission_fingerprint,before_admission_required=true,
    draft_version = draft_version + 1,
    last_mutation_request_id = p_save_request_id,
    last_mutation_expected_version = p_expected_draft_version,
    last_mutation_kind = 'SAVE',
    last_saved_at = v_now, retention_review_at = v_now + interval '365 days'
    where draft_id = v_draft.draft_id returning * into v_draft;
  return jsonb_build_object('draft', to_jsonb(v_draft), 'replayed', false);
end;
$function$;
 alter function private.save_composer_before_draft_v1(uuid,date,uuid,integer,uuid,uuid,uuid,integer,jsonb,text,uuid,text,text) owner to composer_before_owner;
 revoke all on function private.save_composer_before_draft_v1(uuid,date,uuid,integer,uuid,uuid,uuid,integer,jsonb,text,uuid,text,text) from public,anon,authenticated,service_role;grant execute on function private.save_composer_before_draft_v1(uuid,date,uuid,integer,uuid,uuid,uuid,integer,jsonb,text,uuid,text,text) to composer_before_executor;

CREATE OR REPLACE FUNCTION private.save_phase2_composer_draft_v1(p_household_id uuid, p_target_month date, p_expected_draft_id uuid, p_expected_draft_version integer, p_save_request_id uuid, p_base_plan_id uuid, p_base_plan_revision_id uuid, p_base_plan_revision_number integer, p_semantic_state jsonb, p_semantic_state_digest text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if private.composer_before_scopes_lock(v_user_id,p_household_id,p_target_month) then raise exception using errcode='55000',message='BEFORE_COMPATIBILITY_REQUIRED';end if;
if private.composer_before_reserved(p_semantic_state) then raise exception using errcode='55000',message='BEFORE_COMPATIBILITY_REQUIRED';end if;
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
$function$;
CREATE OR REPLACE FUNCTION private.archive_phase2_composer_draft_v1(p_household_id uuid, p_target_month date, p_draft_id uuid, p_expected_draft_version integer, p_archive_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if private.composer_before_scopes_lock(v_user_id,p_household_id,p_target_month) then raise exception using errcode='55000',message='BEFORE_COMPATIBILITY_REQUIRED';end if;
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
$function$;
CREATE OR REPLACE FUNCTION private.restore_phase2_composer_draft_v1(p_household_id uuid, p_target_month date, p_draft_id uuid, p_expected_draft_version integer, p_restore_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if private.composer_before_scopes_lock(v_user_id,p_household_id,p_target_month) then raise exception using errcode='55000',message='BEFORE_COMPATIBILITY_REQUIRED';end if;
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
$function$;
CREATE OR REPLACE FUNCTION private.save_phase2_composer_draft_v2(p_household_id uuid, p_target_month date, p_expected_draft_id uuid, p_expected_draft_version integer, p_save_request_id uuid, p_base_plan_id uuid, p_base_plan_revision_id uuid, p_base_plan_revision_number integer, p_semantic_state jsonb, p_semantic_state_digest text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_draft public.phase2_composer_drafts;
  v_plan public.phase2_month_plans;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if v_user_id is null
    or not coalesce(private.phase2_composer_draft_access_allowed_v2(), false)
    or not coalesce(private.user_has_household_access(p_household_id), false) then
    raise exception using errcode = '42501', message = 'COMPOSER_DRAFT_ACCESS_DENIED';
  end if;
  if private.composer_before_scopes_lock(v_user_id,p_household_id,p_target_month) then raise exception using errcode='55000',message='BEFORE_COMPATIBILITY_REQUIRED';end if;
if private.composer_before_reserved(p_semantic_state) then raise exception using errcode='55000',message='BEFORE_COMPATIBILITY_REQUIRED';end if;
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
  select * into v_plan from public.phase2_month_plans
    where household_id = p_household_id and target_month = p_target_month for share;
  if p_base_plan_id is distinct from
      (case when v_plan.active_revision_id is null then null else v_plan.plan_id end)
    or p_base_plan_revision_id is distinct from v_plan.active_revision_id
    or p_base_plan_revision_number <> coalesce(v_plan.active_revision_number, 0) then
    raise exception using errcode = '40001', message = 'COMPOSER_DRAFT_BASE_STALE';
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
$function$;
CREATE OR REPLACE FUNCTION private.archive_phase2_composer_draft_v2(p_household_id uuid, p_target_month date, p_draft_id uuid, p_expected_draft_version integer, p_archive_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_draft public.phase2_composer_drafts;
begin
  if v_user_id is null
    or not coalesce(private.phase2_composer_draft_access_allowed_v2(), false)
    or not coalesce(private.user_has_household_access(p_household_id), false) then
    raise exception using errcode = '42501', message = 'COMPOSER_DRAFT_ACCESS_DENIED';
  end if;
  if private.composer_before_scopes_lock(v_user_id,p_household_id,p_target_month) then raise exception using errcode='55000',message='BEFORE_COMPATIBILITY_REQUIRED';end if;
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
$function$;
CREATE OR REPLACE FUNCTION private.restore_phase2_composer_draft_v2(p_household_id uuid, p_target_month date, p_draft_id uuid, p_expected_draft_version integer, p_restore_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_draft public.phase2_composer_drafts;
begin
  if v_user_id is null
    or not coalesce(private.phase2_composer_draft_access_allowed_v2(), false)
    or not coalesce(private.user_has_household_access(p_household_id), false) then
    raise exception using errcode = '42501', message = 'COMPOSER_DRAFT_ACCESS_DENIED';
  end if;
  if private.composer_before_scopes_lock(v_user_id,p_household_id,p_target_month) then raise exception using errcode='55000',message='BEFORE_COMPATIBILITY_REQUIRED';end if;
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
$function$;
comment on table private.composer_before_scopes is 'Monotone Before admission requirement; application rollback cannot downgrade this scope.';
commit;
