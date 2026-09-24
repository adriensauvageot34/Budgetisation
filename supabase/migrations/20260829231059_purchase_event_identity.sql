begin;

create table public.purchase_events (
  purchase_event_id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (household_id),
  provenance text not null check (provenance in (
    'EXPLICIT_USER_ASSERTION',
    'STRUCTURED_CANONICAL_SOURCE',
    'CONTROLLED_BACKFILL'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_events_household_identity_unique
    unique (purchase_event_id, household_id)
);

create table public.purchase_event_memberships (
  purchase_event_membership_id uuid primary key default gen_random_uuid(),
  purchase_event_id uuid not null,
  household_id uuid not null references public.households (household_id),
  membership_kind text not null check (membership_kind in ('CONSUMPTION_COMPONENT', 'EVIDENCE_SOURCE')),
  operation_id uuid references public.operations (operation_id),
  allocation_id uuid references public.operation_allocations (allocation_id),
  item_id uuid references public.operation_items (item_id),
  payment_component_id uuid references public.payment_components (payment_component_id),
  cash_use_id uuid references public.cash_economic_uses (cash_use_id),
  canonical_component_key text generated always as (
    case
      when operation_id is not null then 'operation:' || operation_id::text
      when allocation_id is not null then 'allocation:' || allocation_id::text
      when item_id is not null then 'item:' || item_id::text
      when payment_component_id is not null then 'payment_component:' || payment_component_id::text
      when cash_use_id is not null then 'cash_use:' || cash_use_id::text
    end
  ) stored,
  evidence_refs jsonb not null default '[]'::jsonb,
  provenance text not null check (provenance in ('EXPLICIT_USER_ASSERTION', 'STRUCTURED_CANONICAL_SOURCE', 'CONTROLLED_BACKFILL')),
  created_at timestamptz not null default now(),
  constraint purchase_event_memberships_event_household_fk
    foreign key (purchase_event_id, household_id)
    references public.purchase_events (purchase_event_id, household_id)
    on delete cascade,
  constraint purchase_event_memberships_source_xor check (
    num_nonnulls(operation_id, allocation_id, item_id, payment_component_id, cash_use_id) = 1
  ),
  constraint purchase_event_memberships_evidence_array check (jsonb_typeof(evidence_refs) = 'array'),
  constraint purchase_event_memberships_event_source_unique
    unique (purchase_event_id, membership_kind, canonical_component_key)
);

create unique index purchase_event_consumption_owner_unique
  on public.purchase_event_memberships (canonical_component_key)
  where membership_kind = 'CONSUMPTION_COMPONENT';

create table public.purchase_event_timing_assertions (
  purchase_event_timing_assertion_id uuid primary key default gen_random_uuid(),
  purchase_event_id uuid not null,
  household_id uuid not null references public.households (household_id),
  timing_authority text not null check (timing_authority in (
    'EXPLICIT_EVENT', 'EXPLICIT_CONSUMPTION_SOURCE', 'TRUSTED_PURCHASE_SOURCE', 'ECONOMIC_MONTH'
  )),
  timing_precision text not null check (timing_precision in ('DAY', 'MONTH')),
  economic_date date,
  economic_month date,
  evidence_refs jsonb not null,
  provenance text not null check (provenance in ('EXPLICIT_USER_ASSERTION', 'STRUCTURED_CANONICAL_SOURCE', 'CONTROLLED_BACKFILL')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint purchase_event_timing_event_household_fk
    foreign key (purchase_event_id, household_id)
    references public.purchase_events (purchase_event_id, household_id)
    on delete cascade,
  constraint purchase_event_timing_evidence_required check (
    jsonb_typeof(evidence_refs) = 'array' and jsonb_array_length(evidence_refs) > 0
  ),
  constraint purchase_event_timing_shape check (
    (timing_precision = 'DAY' and timing_authority <> 'ECONOMIC_MONTH'
      and economic_date is not null
      and economic_month = date_trunc('month', economic_date)::date)
    or
    (timing_precision = 'MONTH'
      and economic_date is null
      and economic_month = date_trunc('month', economic_month)::date)
  )
);

create index purchase_event_timing_active_lookup
  on public.purchase_event_timing_assertions (purchase_event_id, timing_authority)
  where is_active;

create or replace function private.assert_history_v2_household_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  canonical_household_id uuid;
  canonical_household_count bigint;
  canonical_status text;
begin
  select household_id, household_count, status
    into canonical_household_id, canonical_household_count, canonical_status
  from public.canonical_household_scope_control;

  if canonical_status is distinct from 'READY'
    or canonical_household_count is distinct from 1
    or new.household_id is distinct from canonical_household_id
  then
    raise exception using
      errcode = '23514',
      message = 'History V2 row is outside the canonical Household scope.';
  end if;
  return new;
end;
$$;

revoke all on function private.assert_history_v2_household_scope() from PUBLIC, anon, authenticated;
grant execute on function private.assert_history_v2_household_scope() to service_role;

create trigger purchase_events_household_scope_guard
before insert or update of household_id on public.purchase_events
for each row execute function private.assert_history_v2_household_scope();

create trigger purchase_event_memberships_household_scope_guard
before insert or update of household_id on public.purchase_event_memberships
for each row execute function private.assert_history_v2_household_scope();

create trigger purchase_event_timing_household_scope_guard
before insert or update of household_id on public.purchase_event_timing_assertions
for each row execute function private.assert_history_v2_household_scope();

alter table public.purchase_events enable row level security;
alter table public.purchase_event_memberships enable row level security;
alter table public.purchase_event_timing_assertions enable row level security;

revoke all on table public.purchase_events from PUBLIC, anon, authenticated;
revoke all on table public.purchase_event_memberships from PUBLIC, anon, authenticated;
revoke all on table public.purchase_event_timing_assertions from PUBLIC, anon, authenticated;
grant all on table public.purchase_events to service_role;
grant all on table public.purchase_event_memberships to service_role;
grant all on table public.purchase_event_timing_assertions to service_role;

commit;
