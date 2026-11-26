begin;

create function private.savings_goal_allocations_valid(entries jsonb, target integer, deadline date)
returns boolean language sql immutable security invoker set search_path = ''
as $$
  select count(*) = count(distinct a.id)
    and coalesce(bool_and(coalesce(
      a.id is not null and a.month ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'
      and a.cents between 1 and 99999999
      and a.status in ('planned', 'saved', 'purchased')
      and a.accounted is not null and (a.status <> 'planned' or not a.accounted)
      and (a.status <> 'planned' or deadline is null or a.month <= to_char(deadline, 'YYYY-MM')),
      false)), true)
    and (count(*) = 0 or target is not null and sum(a.cents) <= target)
  from jsonb_to_recordset(entries) as a(id uuid, month text, cents integer, status text, accounted boolean);
$$;
revoke all on function private.savings_goal_allocations_valid(jsonb, integer, date) from public, anon;
grant execute on function private.savings_goal_allocations_valid(jsonb, integer, date) to authenticated, service_role;

create table public.phase2_savings_goals (
  goal_id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(household_id),
  label text not null check (char_length(btrim(label)) between 1 and 100),
  project text not null check (project in ('birthday', 'christmas', 'travel', 'other')),
  target_cents integer check (target_cents between 1 and 99999999),
  deadline date,
  template_key text check (char_length(template_key) <= 60),
  allocations jsonb not null default '[]'::jsonb,
  revision integer not null default 1 check (revision > 0),
  unique (household_id, template_key),
  check (jsonb_typeof(allocations) = 'array' and jsonb_array_length(allocations) <= 100),
  check (private.savings_goal_allocations_valid(allocations, target_cents, deadline))
);

alter table public.phase2_savings_goals enable row level security;
revoke all on public.phase2_savings_goals from public, anon, authenticated;
grant select, insert on public.phase2_savings_goals to authenticated;
grant update (label, project, target_cents, deadline, allocations, revision) on public.phase2_savings_goals to authenticated;
grant select on public.phase2_savings_goals to service_role;

create policy savings_goals_read on public.phase2_savings_goals
  for select to authenticated using ((select private.user_has_household_access(household_id)));
create policy savings_goals_insert on public.phase2_savings_goals
  for insert to authenticated with check ((select private.user_has_household_access(household_id)));
create policy savings_goals_update on public.phase2_savings_goals
  for update to authenticated using ((select private.user_has_household_access(household_id)))
  with check ((select private.user_has_household_access(household_id)));

create view public.phase2_savings_goal_month_entries with (security_invoker = true) as
  select g.household_id, g.goal_id, g.label, g.project, g.deadline,
    a.id, a.month as target_month, a.cents, a.status, a.accounted
  from public.phase2_savings_goals g
  cross join lateral jsonb_to_recordset(g.allocations) as a(id uuid, month text, cents integer, status text, accounted boolean);

revoke all on public.phase2_savings_goal_month_entries from public, anon, authenticated;
grant select on public.phase2_savings_goal_month_entries to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
