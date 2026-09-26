create table public.phase2_month_inputs (
  household_id uuid not null references public.households(household_id),
  target_month date not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (household_id, target_month),
  constraint phase2_month_inputs_first_day check (target_month = date_trunc('month', target_month)::date)
);

alter table public.phase2_month_inputs enable row level security;
revoke all on public.phase2_month_inputs from anon, authenticated;
grant select, insert, update on public.phase2_month_inputs to authenticated;

create policy phase2_month_inputs_read on public.phase2_month_inputs
  for select to authenticated
  using ((select private.user_has_household_access(household_id)));
create policy phase2_month_inputs_insert on public.phase2_month_inputs
  for insert to authenticated
  with check ((select private.user_has_household_access(household_id)) and updated_by = (select auth.uid()));
create policy phase2_month_inputs_update on public.phase2_month_inputs
  for update to authenticated
  using ((select private.user_has_household_access(household_id)))
  with check ((select private.user_has_household_access(household_id)) and updated_by = (select auth.uid()));
