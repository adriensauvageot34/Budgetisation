create table public.composer_realized_reviews (
  household_id uuid not null references public.households(household_id) on delete cascade,
  target_month date not null check (extract(day from target_month) = 1),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'
    and payload @> '{"version":1}'::jsonb
    and jsonb_typeof(payload->'cards') = 'array'
    and jsonb_typeof(payload->'participants') = 'object'),
  primary key (household_id, target_month)
);

alter table public.composer_realized_reviews enable row level security;
revoke all on public.composer_realized_reviews from public, anon, authenticated;
grant select, insert, update on public.composer_realized_reviews to service_role;

comment on table public.composer_realized_reviews is
  'Household-approved presentation decisions for Composer. Canonical operations, events and mobility legs remain the financial sources.';
