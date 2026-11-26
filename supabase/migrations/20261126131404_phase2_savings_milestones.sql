begin;

alter table public.phase2_savings_goals
  add column planned_purchase_date date,
  add column priority text not null default 'normal' check (priority in ('essential', 'normal', 'flexible')),
  add constraint savings_purchase_before_deadline
    check (deadline is null or planned_purchase_date is null or planned_purchase_date <= deadline);

update public.phase2_savings_goals set priority = 'essential'
  where template_key = 'passport-adrien';

grant update (priority, planned_purchase_date) on public.phase2_savings_goals to authenticated;

-- One transaction for all affected goals, with household RLS and revision guards.
create function public.apply_phase2_savings_schedule(p_household uuid, p_updates jsonb)
returns void language plpgsql security invoker set search_path = ''
as $$
declare entry record;
begin
  if jsonb_typeof(p_updates) is distinct from 'array' or
    jsonb_array_length(p_updates) not between 1 and 100 then
    raise exception 'INVALID_SCHEDULE' using errcode = '22023';
  end if;
  for entry in
    select * from jsonb_to_recordset(p_updates) as r(id uuid, revision integer, allocations jsonb) order by id
  loop
    update public.phase2_savings_goals g
    set allocations = entry.allocations, revision = g.revision + 1
    where g.household_id = p_household and g.goal_id = entry.id and g.revision = entry.revision;
    if not found then raise exception 'SCHEDULE_CHANGED' using errcode = '40001'; end if;
  end loop;
end;
$$;
revoke all on function public.apply_phase2_savings_schedule(uuid, jsonb) from public, anon;
grant execute on function public.apply_phase2_savings_schedule(uuid, jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
