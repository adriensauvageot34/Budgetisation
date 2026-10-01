-- UX Builder: a visit / free project has no fabricated zero-valued CostItem.
-- Live preflight: 0 prospective rows. No historical table or RLS change.
begin;
alter table public.phase2_planned_expenses
  drop constraint phase2_planned_expenses_cost_items;
alter table public.phase2_planned_expenses
  add constraint phase2_planned_expenses_cost_items check (
    private.phase2_valid_cost_items(cost_items)
    or (cost_items = '[]'::jsonb and (
      (family_key = 'visit_trip' and subtype_key in ('family_visit', 'friend_visit'))
      or (family_key = 'outing' and subtype_key = 'house_party')
      or (family_key = 'food' and subtype_key = 'work_meal' and context->>'workMealMode' = 'FROM_HOME')
      or (family_key in ('activity', 'visit_trip') and context->'noExpense' = 'true'::jsonb)
    ))
  );
commit;
