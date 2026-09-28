-- Prospective Phase 2 data only. No historical/analytics trigger or publication hook.
create table public.phase2_planned_expenses (
  planned_expense_id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(household_id),
  target_month date not null,
  family_key text not null,
  subtype_key text,
  title text not null,
  planned_date date,
  status text not null default 'PLANNED',
  cost_items jsonb not null,
  context jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint phase2_planned_expenses_first_day check (target_month = date_trunc('month', target_month)::date),
  constraint phase2_planned_expenses_planned_date_month check
    (planned_date is null or date_trunc('month', planned_date)::date = target_month),
  constraint phase2_planned_expenses_status check (status in ('PLANNED', 'DECLARED_REALIZED')),
  constraint phase2_planned_expenses_title check (char_length(btrim(title)) between 1 and 120),
  constraint phase2_planned_expenses_cost_items check
    (case when jsonb_typeof(cost_items) = 'array' then jsonb_array_length(cost_items) between 1 and 50 else false end),
  constraint phase2_planned_expenses_context check (jsonb_typeof(context) = 'object')
);

create index phase2_planned_expenses_household_month_idx
  on public.phase2_planned_expenses (household_id, target_month);

alter table public.phase2_planned_expenses enable row level security;
revoke all on public.phase2_planned_expenses from public, anon, authenticated;
grant select, insert, delete on public.phase2_planned_expenses to authenticated;
-- The API cannot reassign ownership or authorship; only the service updates these columns.
grant update (family_key, subtype_key, title, planned_date, status, cost_items, context, updated_by, updated_at)
  on public.phase2_planned_expenses to authenticated;

create policy phase2_planned_expenses_read on public.phase2_planned_expenses
  for select to authenticated
  using ((select private.user_has_household_access(household_id)));
create policy phase2_planned_expenses_insert on public.phase2_planned_expenses
  for insert to authenticated
  with check ((select private.user_has_household_access(household_id))
    and created_by = (select auth.uid()) and updated_by = (select auth.uid()));
create policy phase2_planned_expenses_update on public.phase2_planned_expenses
  for update to authenticated
  using ((select private.user_has_household_access(household_id)))
  with check ((select private.user_has_household_access(household_id)) and updated_by = (select auth.uid()));
create policy phase2_planned_expenses_delete on public.phase2_planned_expenses
  for delete to authenticated
  using ((select private.user_has_household_access(household_id)));
