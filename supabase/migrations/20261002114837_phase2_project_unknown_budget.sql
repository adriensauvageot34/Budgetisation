-- Live preflight (2026-10-02): 0 prospective rows.
-- A V2 unpriced project is incomplete, never a fabricated zero-price CostItem.
begin;
alter table public.phase2_planned_expenses drop constraint phase2_planned_expenses_cost_items;
alter table public.phase2_planned_expenses add constraint phase2_planned_expenses_cost_items check (
  private.phase2_valid_cost_items(cost_items)
  or (cost_items = '[]'::jsonb and (
    (family_key = 'visit_trip' and subtype_key in ('family_visit', 'friend_visit'))
    or (family_key = 'outing' and subtype_key = 'house_party')
    or (family_key = 'food' and subtype_key = 'work_meal' and context->>'workMealMode' = 'FROM_HOME')
    or (family_key in ('activity', 'visit_trip') and context->'noExpense' = 'true'::jsonb)
    or (context->'project'->>'version' = '2'
      and jsonb_typeof(context->'project'->'unpricedComponents') = 'array'
      and jsonb_array_length(context->'project'->'unpricedComponents') between 1 and 20)
  ))
);
commit;
