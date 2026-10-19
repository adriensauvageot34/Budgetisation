-- PROPOSAL ONLY, not an authorized migration. Default publisher registry EMPTY.
-- Canonical owns this mapping publication, not Global or the favourites owner.
-- Existing public.referentiel_lieu(place_id,private_place) and auth.users required.
begin;
set local lock_timeout='5s';
create table private.canonical_google_publications (
 scope_id uuid primary key references public.households(household_id),
 publisher_id uuid references auth.users(id) on delete set null,
 enabled boolean not null default false,
 generation bigint not null default 0 check(generation between 0 and 9007199254740990)
);
create table private.canonical_google_mappings (
 scope_id uuid not null references private.canonical_google_publications(scope_id),
 google_place_id text not null check(google_place_id ~ '^[A-Za-z0-9_-]{5,255}$'),
 canonical_place_id uuid not null references public.referentiel_lieu(place_id),
 mapping_version bigint not null check(mapping_version between 1 and 9007199254740991),
 admitted_generation bigint not null check(admitted_generation>0),
 provenance text not null check(provenance='EXPLICIT_CANONICAL_PUBLISHER_EXACT_ID'),
 primary key(scope_id,google_place_id)
);
create table private.canonical_google_admission_requests (
 actor_id uuid not null references auth.users(id) on delete cascade,
 scope_id uuid not null references private.canonical_google_publications(scope_id),
 request_id uuid not null,command jsonb not null,receipt jsonb not null,
 created_at timestamptz not null default now(),primary key(actor_id,scope_id,request_id)
);
alter table private.canonical_google_publications enable row level security;
alter table private.canonical_google_mappings enable row level security;
alter table private.canonical_google_admission_requests enable row level security;
revoke all on private.canonical_google_publications,private.canonical_google_mappings,private.canonical_google_admission_requests from public,anon,authenticated,service_role;
-- No public wrapper, no client DML. Invocation is deliberately NOT GRANTED,
-- including to service_role, before the proposed governance is approved.
create function private.publish_canonical_google_place_v1(p_actor uuid,p_command jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s private.canonical_google_publications%rowtype;m private.canonical_google_mappings%rowtype;
 old private.canonical_google_admission_requests%rowtype;v_scope uuid;rid uuid;cid uuid;gid text;eg bigint;ev bigint;r jsonb;
begin
 if jsonb_typeof(p_command) is distinct from 'object' or p_command->>'version' is distinct from 'canonical-google-admission@v1'
 or p_command->>'kind' is distinct from 'BAR_APERO' or not(p_command ?& array['version','kind','requestId','intendedScope','canonicalPlaceId','googlePlaceId','expectedSourceGeneration','expectedMappingVersion'])
 or exists(select 1 from jsonb_object_keys(p_command) k where k not in ('version','kind','requestId','intendedScope','canonicalPlaceId','googlePlaceId','expectedSourceGeneration','expectedMappingVersion'))
 or jsonb_typeof(p_command->'expectedSourceGeneration') is distinct from 'number' or (p_command->>'expectedSourceGeneration') !~ '^[0-9]+$'
 or jsonb_typeof(p_command->'expectedMappingVersion') is distinct from 'number' or (p_command->>'expectedMappingVersion') !~ '^[0-9]+$'
 then return jsonb_build_object('status','CONFLICT');end if;
 begin
 v_scope:=(p_command->>'intendedScope')::uuid;rid:=(p_command->>'requestId')::uuid;cid:=(p_command->>'canonicalPlaceId')::uuid;gid:=p_command->>'googlePlaceId';
 eg:=(p_command->>'expectedSourceGeneration')::bigint;ev:=(p_command->>'expectedMappingVersion')::bigint;
 exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','CONFLICT');end;
 if gid is null or gid !~ '^[A-Za-z0-9_-]{5,255}$' or eg is null or eg<0 or eg>9007199254740990 or ev is null or ev<0 or ev>9007199254740990 or rid is null or cid is null then return jsonb_build_object('status','CONFLICT');end if;
 select * into s from private.canonical_google_publications p where p.scope_id=v_scope for update;
 if not found or not s.enabled or s.publisher_id is distinct from p_actor or not exists(select 1 from auth.users u where u.id=p_actor and (u.banned_until is null or u.banned_until<=now())) then return jsonb_build_object('status','DENIED');end if;
 select * into old from private.canonical_google_admission_requests q where q.actor_id=p_actor and q.scope_id=v_scope and q.request_id=rid;
 if found then if old.command<>p_command then return jsonb_build_object('status','CONFLICT');end if;return old.receipt||jsonb_build_object('replayed',true);end if;
 if not exists(select 1 from public.referentiel_lieu l where l.place_id=cid and l.private_place=false) then return jsonb_build_object('status','DENIED');end if;
 select * into m from private.canonical_google_mappings x where x.scope_id=v_scope and x.google_place_id=gid;
 if s.generation<>eg or coalesce(m.mapping_version,0)<>ev or (m.canonical_place_id is not null and m.canonical_place_id<>cid) then return jsonb_build_object('status','CONFLICT');end if;
 update private.canonical_google_publications p set generation=p.generation+1 where p.scope_id=v_scope returning * into s;
 insert into private.canonical_google_mappings values(v_scope,gid,cid,ev+1,s.generation,'EXPLICIT_CANONICAL_PUBLISHER_EXACT_ID')
 on conflict(scope_id,google_place_id) do update set mapping_version=excluded.mapping_version,admitted_generation=excluded.admitted_generation;
 r:=jsonb_build_object('status','PUBLISHED','requestId',rid,'generation',s.generation,'mappingVersion',ev+1,'canonicalPlaceId',cid,'replayed',false);
 insert into private.canonical_google_admission_requests values(p_actor,v_scope,rid,p_command,r,now());return r;
end $$;
alter function private.publish_canonical_google_place_v1(uuid,jsonb) owner to postgres;
revoke all on function private.publish_canonical_google_place_v1(uuid,jsonb) from public,anon,authenticated,service_role;
commit;
