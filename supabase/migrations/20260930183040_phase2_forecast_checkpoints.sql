-- Derived forecast memory only. No historical finance authority is modified.
create table public.phase2_forecast_checkpoints (
  checkpoint_id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(household_id),
  target_month date not null check (target_month = date_trunc('month', target_month)::date),
  as_of_date date not null,
  model_version text not null check (length(model_version) between 1 and 120),
  input_digest text not null check (input_digest ~ '^[0-9a-f]{64}$'),
  computed_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'
    and payload ?& array['categories','components','final','provenance']
    and jsonb_typeof(payload->'categories') = 'array'
    and jsonb_typeof(payload->'components') = 'object'
    and jsonb_typeof(payload->'final') = 'object'
    and jsonb_typeof(payload->'provenance') = 'object'
    and octet_length(payload::text) <= 131072),
  unique (household_id,target_month,as_of_date,model_version,input_digest)
);
create index phase2_forecast_checkpoints_month_idx on public.phase2_forecast_checkpoints
  (household_id,target_month,computed_at desc,checkpoint_id);
alter table public.phase2_forecast_checkpoints enable row level security;
revoke all on public.phase2_forecast_checkpoints from public,anon,authenticated,service_role;
grant select on public.phase2_forecast_checkpoints to authenticated;
grant select,insert on public.phase2_forecast_checkpoints to service_role;
create policy phase2_forecast_checkpoints_read on public.phase2_forecast_checkpoints
  for select to authenticated using ((select private.user_has_household_access(household_id)));
-- Insertion is server-owned: browser clients cannot forge calibration samples.
create function public.phase2_forecast_checkpoints_immutable() returns trigger
language plpgsql security invoker set search_path = pg_catalog as $$
begin raise exception 'FORECAST_CHECKPOINT_IMMUTABLE'; end;
$$;
revoke all on function public.phase2_forecast_checkpoints_immutable() from public,anon,authenticated;
create trigger phase2_forecast_checkpoints_immutable before update or delete
  on public.phase2_forecast_checkpoints for each row
  execute function public.phase2_forecast_checkpoints_immutable();
