-- TEST PROJECT ONLY: wlndjknwbceaqrqcwbqw. Never a Production migration.
-- Auth users/roles/JWT functions are the genuine managed Supabase objects.
begin;
set local lock_timeout='5s';
create schema if not exists private;
create table public.households(household_id uuid primary key,name text not null,timezone text not null default 'Europe/Paris');
create table private.household_memberships(user_id uuid not null references auth.users(id),household_id uuid not null references public.households(household_id),primary key(user_id,household_id));
alter table public.households enable row level security;
alter table private.household_memberships enable row level security;
revoke all on public.households,private.household_memberships from public,anon,authenticated,service_role;
create function private.user_has_household_access(p_household_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.household_memberships m join auth.users u on u.id=m.user_id where m.household_id=p_household_id and m.user_id=(select auth.uid()) and (u.banned_until is null or u.banned_until<=now()));
$$;
revoke all on function private.user_has_household_access(uuid) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.user_has_household_access(uuid) to authenticated;
create policy household_member_read on public.households for select to authenticated using ((select private.user_has_household_access(household_id)));
grant select on public.households to authenticated;
commit;
