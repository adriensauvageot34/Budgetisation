-- N1-C-B CANDIDATE. NOT in migrations/: never auto-apply this file.
-- Local synthetic recipe only in this mandate. Remote execution requires separate review/approval.
-- Transaction owner must wrap the WHOLE file. Existing migration history is unchanged.
set local lock_timeout = '5s';

-- JSON identity, not financial doctrine. Match the existing TS digest's UTF-16 key ordering
-- and ECMAScript numeric notation on normalized JSON received from its strict parser.
create function private.phase2_n1_utf16_key_v1(t text) returns bytea
language plpgsql immutable strict security invoker set search_path='' as $$
declare result bytea := ''::bytea; cp integer; i integer;
begin
  for i in 1..length(t) loop
    cp:=ascii(substr(t,i,1));
    if cp>65535 then
      result:=result||decode(lpad(to_hex(55296+((cp-65536)/1024)),4,'0'),'hex');
      cp:=56320+((cp-65536)%1024);
    end if;
    result:=result||decode(lpad(to_hex(cp),4,'0'),'hex');
  end loop;
  return result;
end $$;
revoke all on function private.phase2_n1_utf16_key_v1(text) from public,anon,authenticated,service_role;

create function private.phase2_n1_canonical_json_v1(s jsonb) returns text
language plpgsql immutable strict security invoker set search_path='' as $$
declare result text; n numeric; exponent integer;
begin
  case jsonb_typeof(s)
  when 'object' then
    select '{'||coalesce(string_agg(to_jsonb(key)::text||':'||private.phase2_n1_canonical_json_v1(value),','
      order by private.phase2_n1_utf16_key_v1(key)),'')||'}' into result from jsonb_each(s);
  when 'array' then
    select '['||coalesce(string_agg(private.phase2_n1_canonical_json_v1(value),',' order by ord),'')||']'
      into result from jsonb_array_elements(s) with ordinality x(value,ord);
  when 'number' then
    n:=(s::text)::numeric;
    if n=0 then return '0';end if;
    if abs(n)>=1e21::numeric or abs(n)<1e-6::numeric then
      exponent:=floor(log(10::numeric,abs(n)))::integer;
      result:=trim_scale(n/power(10::numeric,exponent))::text||'e'||case when exponent>=0 then '+' else '' end||exponent::text;
    else result:=trim_scale(n)::text;end if;
  else result:=s::text;
  end case;
  return result;
end $$;
revoke all on function private.phase2_n1_canonical_json_v1(jsonb) from public,anon,authenticated,service_role;

create function private.phase2_root_plan_state_valid_v1(s jsonb, m date)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare r jsonb; c jsonb; member jsonb; ids text[] := '{}'; members text[] := '{}'; rid text; mid text;
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if s->>'version' = 'month-plan-state@v1' then return private.phase2_month_plan_state_valid_v1(s,m); end if;
  if s->>'version' is distinct from 'month-plan-state@v2-root-relations'
    or s - array['version','targetMonth','controls','contexts','preferences','rootRelations'] <> '{}'::jsonb
    or not coalesce(private.phase2_month_plan_state_valid_v1(
      jsonb_set(s-'rootRelations','{version}','"month-plan-state@v1"'),m),false)
    or jsonb_typeof(s->'rootRelations') is distinct from 'array' then return false; end if;
  if jsonb_array_length(s->'rootRelations') > 500 then return false; end if;
  for r in select value from jsonb_array_elements(s->'rootRelations') loop
    rid := r->>'relationId';
    if jsonb_typeof(r) is distinct from 'object'
      or r - array['version','relationId','targetMonth','orderedContextIds','provenance'] <> '{}'::jsonb
      or r->>'version' is distinct from 'root-context-relation@v1'
      or rid is null or rid !~ uuid_re or rid = any(ids)
      or r->>'targetMonth' is distinct from to_char(m,'YYYY-MM')
      or r->>'provenance' is distinct from 'EXPLICIT_USER_DECISION'
      or jsonb_typeof(r->'orderedContextIds') is distinct from 'array' then return false; end if;
    if jsonb_array_length(r->'orderedContextIds') not between 2 and 500
      or exists(select 1 from jsonb_array_elements(s->'contexts') x where x->>'contextOccurrenceId'=rid)
      then return false; end if;
    ids := array_append(ids,rid);
    for member in select value from jsonb_array_elements(r->'orderedContextIds') loop
      mid := member#>>'{}';
      if jsonb_typeof(member) is distinct from 'string' or mid !~ uuid_re or mid = any(members) then return false; end if;
      members := array_append(members,mid);
      select value into c from jsonb_array_elements(s->'contexts') where value->>'contextOccurrenceId'=mid;
      if not found or c->>'parentContextOccurrenceId' is not null or c->>'templateKey' <> 'night-out'
        or coalesce(c#>>'{fields,composerPresentation,presetKey}','') not in ('friends-evening','bar-apero')
        or c#>>'{fields,composerPresentation,version}' is distinct from 'composer-context-presentation@v1'
        or (jsonb_typeof(c#>'{fields,plannedDate}')='string' and left(c#>>'{fields,plannedDate}',7) <> to_char(m,'YYYY-MM'))
        then return false; end if;
    end loop;
  end loop;
  return true;
exception when others then return false;
end $$;
revoke all on function private.phase2_root_plan_state_valid_v1(jsonb,date) from public,anon,authenticated,service_role;

alter table public.phase2_composer_drafts drop constraint phase2_composer_drafts_state;
alter table public.phase2_composer_drafts add constraint phase2_composer_drafts_state
  check (private.phase2_root_plan_state_valid_v1(semantic_state,target_month));
alter table public.phase2_composer_drafts add column n1_last_command jsonb;

create table private.phase2_root_durable_gate(singleton boolean primary key default true check(singleton),
  enabled boolean not null default false);
insert into private.phase2_root_durable_gate(singleton) values(true);
alter table private.phase2_root_durable_gate enable row level security;
revoke all on private.phase2_root_durable_gate from public,anon,authenticated,service_role;

-- Deliberately NOT granted to service_role, authenticated or anon. No public wrapper.
-- This storage primitive is NOT an owner/C4/G-A admission. Runtime must fail closed until
-- a transaction-bound authority mechanism is received. PostgreSQL owner alone can recipe it.
create function private.phase2_root_draft_identity_v1(d public.phase2_composer_drafts)
returns jsonb language sql immutable security invoker set search_path='' as $$
  select to_jsonb(d)-array['created_at','last_saved_at','archived_at','retention_review_at','n1_last_command'];
$$;
revoke all on function private.phase2_root_draft_identity_v1(public.phase2_composer_drafts) from public,anon,authenticated,service_role;

create function private.store_phase2_root_draft_v1(p_actor uuid,p_household uuid,p_packet jsonb,p_source_identity jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare d public.phase2_composer_drafts; plan public.phase2_month_plans; cmd jsonb := p_packet->'command';
  month date; request_id uuid; expected_version integer; expected_id uuid; payload jsonb;
  receipt_identity jsonb; envelope jsonb; v_now timestamptz := clock_timestamp();
begin
  perform 1 from private.phase2_root_durable_gate where singleton and enabled for share;
  if not found then raise exception using errcode='42501',message='N1_DURABLE_DISABLED';end if;
  if p_actor is null or p_actor is distinct from auth.uid()
    or not coalesce(private.phase2_composer_draft_access_allowed_v2(),false)
    or not coalesce(private.user_has_household_access(p_household),false) then
    raise exception using errcode='42501',message='N1_DRAFT_ACCESS_DENIED'; end if;
  if p_packet->>'contract' is distinct from 'composer-draft-http@2-root-relations'
    or p_packet->>'kind' is distinct from 'SAVE'
    or p_packet-array['contract','kind','command'] <> '{}'::jsonb
    or jsonb_typeof(cmd) is distinct from 'object'
    or cmd-array['targetMonth','expectedDraftId','expectedDraftVersion','expectedDocumentVersion','expectedDraftDigest',
      'expectedBaseRevisionId','expectedBaseRevisionNumber','requestId','semanticState','digest'] <> '{}'::jsonb then
    raise exception using errcode='22023',message='N1_DRAFT_PAYLOAD_INVALID'; end if;
  if coalesce(cmd->>'targetMonth','') !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception using errcode='22023',message='N1_DRAFT_SCOPE_MISMATCH'; end if;
  month := (cmd->>'targetMonth'||'-01')::date; payload := cmd->'semanticState';
  request_id := (cmd->>'requestId')::uuid; expected_version := (cmd->>'expectedDraftVersion')::integer;
  expected_id := (cmd->>'expectedDraftId')::uuid;
  if request_id is null or expected_version is null or expected_version<0
    or ((expected_id is null) <> (expected_version=0))
    or payload->>'version' is distinct from 'month-plan-state@v2-root-relations'
    or not coalesce(private.phase2_root_plan_state_valid_v1(payload,month),false)
    or coalesce(cmd->>'digest','') !~ '^[a-f0-9]{64}$' or octet_length(payload::text)>1048576
    or encode(sha256(convert_to(private.phase2_n1_canonical_json_v1(payload),'UTF8')),'hex') is distinct from cmd->>'digest'
    or (cmd->>'expectedBaseRevisionNumber') is null
    or (cmd->>'expectedBaseRevisionNumber')::integer<0
    or ((cmd->>'expectedBaseRevisionId' is null) <> ((cmd->>'expectedBaseRevisionNumber')::integer=0))
    then raise exception using errcode='22023',message='N1_DRAFT_PAYLOAD_INVALID'; end if;
  -- Serialize N1 creates. Legacy creates also meet the existing unique ACTIVE index.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor::text||p_household::text||month::text,0));
  if expected_id is null then
    select * into d from public.phase2_composer_drafts where owner_user_id=p_actor and household_id=p_household
      and target_month=month and lifecycle='ACTIVE' for update;
  else
    select * into d from public.phase2_composer_drafts where draft_id=expected_id and owner_user_id=p_actor
      and household_id=p_household and target_month=month and lifecycle='ACTIVE' for update;
  end if;
  envelope := jsonb_build_object('packet',p_packet,'source',p_source_identity);
  if d.draft_id is not null and d.last_mutation_request_id=request_id then
    if d.n1_last_command=envelope and d.draft_version=expected_version+1 and d.last_mutation_kind='SAVE'
      and d.last_mutation_expected_version=expected_version and d.semantic_state=payload
      and d.semantic_state_digest=cmd->>'digest'
      and d.base_plan_revision_id is not distinct from (cmd->>'expectedBaseRevisionId')::uuid
      and d.base_plan_revision_number=(cmd->>'expectedBaseRevisionNumber')::integer then
      return jsonb_build_object('draft',to_jsonb(d),'replayed',true); end if;
    raise exception using errcode='40001',message='N1_DRAFT_REQUEST_ID_REUSED';
  end if;
  if expected_id is null then
    if d.draft_id is not null or p_source_identity is not null
      or cmd->>'expectedDocumentVersion' is not null or cmd->>'expectedDraftDigest' is not null then
      raise exception using errcode='40001',message='N1_DRAFT_CONFLICT'; end if;
  elsif d.draft_id is null or d.draft_version<>expected_version
    or d.semantic_state_digest is distinct from cmd->>'expectedDraftDigest'
    or d.semantic_state->>'version' is distinct from cmd->>'expectedDocumentVersion'
    or private.phase2_root_draft_identity_v1(d) is distinct from p_source_identity
    or d.base_plan_revision_id is distinct from (cmd->>'expectedBaseRevisionId')::uuid
    or d.base_plan_revision_number<>(cmd->>'expectedBaseRevisionNumber')::integer then
    raise exception using errcode='40001',message='N1_DRAFT_CONFLICT'; end if;
  -- Covers an absent plan row as well as a changed existing revision. Broad lock is recipe-only;
  -- optimize only with a proven common lock protocol with Apply, never by ignoring the absent-row race.
  lock table public.phase2_month_plans in share mode;
  select * into plan from public.phase2_month_plans where household_id=p_household and target_month=month for share;
  if plan.active_revision_id is distinct from (cmd->>'expectedBaseRevisionId')::uuid
    or coalesce(plan.active_revision_number,0)<>(cmd->>'expectedBaseRevisionNumber')::integer then
    raise exception using errcode='40001',message='N1_DRAFT_BASE_STALE'; end if;
  if expected_id is null then
    insert into public.phase2_composer_drafts(owner_user_id,household_id,target_month,base_plan_id,base_plan_revision_id,
      base_plan_revision_number,semantic_state,semantic_state_digest,last_mutation_request_id,last_mutation_expected_version,
      last_mutation_kind,n1_last_command,created_at,last_saved_at,retention_review_at)
    values(p_actor,p_household,month,case when plan.active_revision_id is null then null else plan.plan_id end,
      plan.active_revision_id,coalesce(plan.active_revision_number,0),payload,cmd->>'digest',request_id,0,'SAVE',envelope,
      v_now,v_now,v_now+interval '365 days')
    returning * into d;
  else
    update public.phase2_composer_drafts set semantic_state=payload,semantic_state_digest=cmd->>'digest',draft_version=draft_version+1,
      last_mutation_request_id=request_id,last_mutation_expected_version=expected_version,last_mutation_kind='SAVE',
      last_saved_at=v_now,retention_review_at=v_now+interval '365 days',n1_last_command=envelope where draft_id=d.draft_id returning * into d;
  end if;
  return jsonb_build_object('draft',to_jsonb(d),'replayed',false);
end $$;
revoke all on function private.store_phase2_root_draft_v1(uuid,uuid,jsonb,jsonb) from public,anon,authenticated,service_role;

-- LEGACY FUNCTIONS BELOW: exact historical bodies with a guard immediately after EVERY
-- SELECT ... FOR UPDATE. Checks precede requestId replay and any mutation. Public wrappers unchanged.

create or replace function private.save_phase2_composer_draft_v1(
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
    if v_draft.draft_id is not null and v_draft.semantic_state->>'version' is distinct from 'month-plan-state@v1' then
      raise exception using errcode='40001',message='COMPOSER_DRAFT_N1_LEGACY_REFUSED';
    end if;
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
    if v_draft.draft_id is not null and v_draft.semantic_state->>'version' is distinct from 'month-plan-state@v1' then
      raise exception using errcode='40001',message='COMPOSER_DRAFT_N1_LEGACY_REFUSED';
    end if;
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
    if v_draft.draft_id is not null and v_draft.semantic_state->>'version' is distinct from 'month-plan-state@v1' then
      raise exception using errcode='40001',message='COMPOSER_DRAFT_N1_LEGACY_REFUSED';
    end if;
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

create or replace function private.archive_phase2_composer_draft_v1(
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
    if v_draft.draft_id is not null and v_draft.semantic_state->>'version' is distinct from 'month-plan-state@v1' then
      raise exception using errcode='40001',message='COMPOSER_DRAFT_N1_LEGACY_REFUSED';
    end if;
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

create or replace function private.restore_phase2_composer_draft_v1(
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
    if v_draft.draft_id is not null and v_draft.semantic_state->>'version' is distinct from 'month-plan-state@v1' then
      raise exception using errcode='40001',message='COMPOSER_DRAFT_N1_LEGACY_REFUSED';
    end if;
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

create or replace function private.save_phase2_composer_draft_v2(
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
    or not coalesce(private.phase2_composer_draft_access_allowed_v2(), false)
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
    if v_draft.draft_id is not null and v_draft.semantic_state->>'version' is distinct from 'month-plan-state@v1' then
      raise exception using errcode='40001',message='COMPOSER_DRAFT_N1_LEGACY_REFUSED';
    end if;
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
    if v_draft.draft_id is not null and v_draft.semantic_state->>'version' is distinct from 'month-plan-state@v1' then
      raise exception using errcode='40001',message='COMPOSER_DRAFT_N1_LEGACY_REFUSED';
    end if;
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
    if v_draft.draft_id is not null and v_draft.semantic_state->>'version' is distinct from 'month-plan-state@v1' then
      raise exception using errcode='40001',message='COMPOSER_DRAFT_N1_LEGACY_REFUSED';
    end if;
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
$fn$;

create or replace function private.archive_phase2_composer_draft_v2(
  p_household_id uuid, p_target_month date, p_draft_id uuid,
  p_expected_draft_version integer, p_archive_request_id uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  v_user_id uuid := auth.uid();
  v_draft public.phase2_composer_drafts;
begin
  if v_user_id is null
    or not coalesce(private.phase2_composer_draft_access_allowed_v2(), false)
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
    if v_draft.draft_id is not null and v_draft.semantic_state->>'version' is distinct from 'month-plan-state@v1' then
      raise exception using errcode='40001',message='COMPOSER_DRAFT_N1_LEGACY_REFUSED';
    end if;
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

create or replace function private.restore_phase2_composer_draft_v2(
  p_household_id uuid, p_target_month date, p_draft_id uuid,
  p_expected_draft_version integer, p_restore_request_id uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  v_user_id uuid := auth.uid();
  v_draft public.phase2_composer_drafts;
begin
  if v_user_id is null
    or not coalesce(private.phase2_composer_draft_access_allowed_v2(), false)
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
    if v_draft.draft_id is not null and v_draft.semantic_state->>'version' is distinct from 'month-plan-state@v1' then
      raise exception using errcode='40001',message='COMPOSER_DRAFT_N1_LEGACY_REFUSED';
    end if;
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
