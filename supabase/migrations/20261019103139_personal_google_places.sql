-- Personal favourites only. Test/staging approved; Production requires separate approval.
-- Requires the existing auth/users, households and private.household_memberships.
begin;
set local lock_timeout='5s';
create table private.personal_google_places (
  saved_place_id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(household_id) on delete cascade,
  provider text not null default 'google_places' check(provider='google_places'),
  external_id text not null check(external_id ~ '^[A-Za-z0-9_-]{5,255}$'),
  user_label text not null check(length(btrim(user_label)) between 1 and 120),
  label_provenance text not null default 'USER_CONFIRMED' check(label_provenance='USER_CONFIRMED'),
  state text not null check(state in ('SAVED','ARCHIVED')),
  version bigint not null check(version>0 and version<=9007199254740991),
  verified_at timestamptz not null,
  unique(owner_user_id,household_id,provider,external_id)
);
create table private.personal_google_place_requests (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(household_id) on delete cascade,
  request_id uuid not null,
  command jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  review_after timestamptz not null default (now()+interval '365 days'),
  check(review_after>=created_at),
  primary key(owner_user_id,household_id,request_id)
);
alter table private.personal_google_places enable row level security;
alter table private.personal_google_place_requests enable row level security;
alter table private.personal_google_places owner to postgres;
alter table private.personal_google_place_requests owner to postgres;
revoke all on private.personal_google_places,private.personal_google_place_requests from public,anon,authenticated,service_role;

-- Only trusted server role, after Auth.getUser + scope derivation + Google Details.
-- Explicit actor is NOT accepted from HTTP payload. No financial or Canonical writer.
create function private.personal_google_place_v1(p_actor uuid,p_household uuid,p_command jsonb,p_mode text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid; v_id text; v_label text; v_action text; v_expected bigint; v_request uuid;
  v_old private.personal_google_places%rowtype; v_prior private.personal_google_place_requests%rowtype; v_result jsonb;
begin
  if p_actor is null or p_household is null or not exists(
    select 1 from private.household_memberships m join auth.users u on u.id=m.user_id
    where m.user_id=p_actor and m.household_id=p_household and (u.banned_until is null or u.banned_until<=now())
  ) then return jsonb_build_object('status','DENIED'); end if;
  if p_mode='READ' then
    return coalesce((select jsonb_agg(jsonb_build_object('id',saved_place_id,'googlePlaceId',external_id,'userLabel',user_label,
      'version',version,'status',state,'kind','PERSONAL_SAVED_PLACE','verifiedAt',verified_at) order by saved_place_id)
      from private.personal_google_places where owner_user_id=p_actor and household_id=p_household),'[]'::jsonb);
  end if;
  if p_mode is null or p_mode not in ('REPLAY','MUTATE') or p_command is null or jsonb_typeof(p_command)<>'object'
    or (p_command->>'version') is distinct from 'personal-google-place@v1'
    or not(p_command ?& array['version','requestId','googlePlaceId','expectedVersion','action','userLabel'])
    or exists(select 1 from jsonb_object_keys(p_command) k where k not in ('version','requestId','googlePlaceId','expectedVersion','action','userLabel'))
    or jsonb_typeof(p_command->'expectedVersion')<>'number'
    or (p_command->>'expectedVersion') !~ '^[0-9]{1,16}$'
    or (p_command->>'requestId') !~* '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
    or (p_command->>'googlePlaceId') !~ '^[A-Za-z0-9_-]{5,255}$'
    or jsonb_typeof(p_command->'action') is distinct from 'string' or (p_command->>'action') not in ('SAVE','ARCHIVE')
    or jsonb_typeof(p_command->'googlePlaceId') is distinct from 'string'
    or jsonb_typeof(p_command->'requestId') is distinct from 'string'
    or jsonb_typeof(p_command->'userLabel')<>'string' or length(btrim(p_command->>'userLabel')) not between 1 and 120
    then return jsonb_build_object('status','INVALID'); end if;
  v_id:=p_command->>'googlePlaceId';v_label:=btrim(p_command->>'userLabel');v_expected:=(p_command->>'expectedVersion')::bigint;
  if v_expected>9007199254740990 then return jsonb_build_object('status','INVALID');end if;
  v_request:=(p_command->>'requestId')::uuid;v_action:=p_command->>'action';
  -- One scope lock serializes different IDs and request replays. Hash collisions only serialize extra work.
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text||':'||p_household::text,0));
  -- Recheck revocation after acquiring a contended lock, not only before waiting.
  if not exists(select 1 from private.household_memberships m join auth.users u on u.id=m.user_id where m.user_id=p_actor and m.household_id=p_household and (u.banned_until is null or u.banned_until<=now())) then return jsonb_build_object('status','DENIED');end if;
  select * into v_prior from private.personal_google_place_requests where owner_user_id=p_actor and household_id=p_household and request_id=v_request;
  if found then
    if v_prior.command<>p_command then return jsonb_build_object('status','CONFLICT');end if;
    return v_prior.result||jsonb_build_object('replayed',true);
  end if;
  if p_mode='REPLAY' then return 'null'::jsonb;end if;
  select * into v_old from private.personal_google_places where owner_user_id=p_actor and household_id=p_household and external_id=v_id for update;
  if coalesce(v_old.version,0)<>v_expected or (v_action='ARCHIVE' and v_old.saved_place_id is null) then return jsonb_build_object('status','CONFLICT');end if;
  insert into private.personal_google_places(owner_user_id,household_id,external_id,user_label,state,version,verified_at)
    values(p_actor,p_household,v_id,v_label,case when v_action='SAVE' then 'SAVED' else 'ARCHIVED' end,v_expected+1,now())
    on conflict(owner_user_id,household_id,provider,external_id) do update set user_label=excluded.user_label,state=excluded.state,version=excluded.version,
      verified_at=case when v_action='SAVE' and private.personal_google_places.state='ARCHIVED' then excluded.verified_at else private.personal_google_places.verified_at end returning * into v_old;
  v_result:=jsonb_build_object('status',case when v_action='SAVE' then 'SAVED' else 'ARCHIVED' end,'replayed',false,
    'place',jsonb_build_object('id',v_old.saved_place_id,'googlePlaceId',v_old.external_id,'userLabel',v_old.user_label,'version',v_old.version,
      'status',v_old.state,'kind','PERSONAL_SAVED_PLACE','verifiedAt',v_old.verified_at));
  insert into private.personal_google_place_requests(owner_user_id,household_id,request_id,command,result) values(p_actor,p_household,v_request,p_command,v_result);
  return v_result;
end $$;
alter function private.personal_google_place_v1(uuid,uuid,jsonb,text) owner to postgres;
revoke all on function private.personal_google_place_v1(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.personal_google_place_v1(uuid,uuid,jsonb,text) to service_role;
create function public.personal_google_place_v1(p_actor uuid,p_household uuid,p_command jsonb,p_mode text)
returns jsonb language sql security invoker set search_path='' as $$
  select private.personal_google_place_v1(p_actor,p_household,p_command,p_mode);
$$;
revoke all on function public.personal_google_place_v1(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.personal_google_place_v1(uuid,uuid,jsonb,text) to service_role;
commit;
