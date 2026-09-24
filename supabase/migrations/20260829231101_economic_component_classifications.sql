begin;

create table public.economic_component_classifications (
  economic_component_classification_id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (household_id),
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
  axis text not null check (axis in ('NECESSITY', 'BEHAVIOR', 'LIFE_SCOPE')),
  status text not null check (status in ('KNOWN', 'UNKNOWN', 'CONFLICT')),
  value text,
  authority text check (authority in ('EXPLICIT_COMPONENT_OVERRIDE', 'AUTHORITATIVE_COMPONENT_SOURCE', 'OPERATION_FALLBACK')),
  evidence_refs jsonb not null default '[]'::jsonb,
  provenance text not null check (provenance in ('EXPLICIT_USER_ASSERTION', 'STRUCTURED_CANONICAL_SOURCE', 'CONTROLLED_BACKFILL')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint economic_component_classifications_source_xor check (
    num_nonnulls(operation_id, allocation_id, item_id, payment_component_id, cash_use_id) = 1
  ),
  constraint economic_component_classifications_value_shape check (
    (status = 'KNOWN' and authority is not null and value is not null)
    or (status = 'CONFLICT' and authority is not null and value is null)
    or (status = 'UNKNOWN' and value is null)
  ),
  constraint economic_component_classifications_axis_value check (
    value is null
    or (axis = 'NECESSITY' and value in ('Indispensable', 'Contraint', 'Optionnel'))
    or (axis = 'BEHAVIOR' and value in ('Fixe', 'Variable'))
    or (axis = 'LIFE_SCOPE' and value in ('Vie courante', 'Hors quotidien'))
  ),
  constraint economic_component_classifications_evidence_array check (
    jsonb_typeof(evidence_refs) = 'array'
    and (status = 'UNKNOWN' or jsonb_array_length(evidence_refs) > 0)
  ),
  constraint economic_component_classifications_component_axis_unique
    unique (household_id, canonical_component_key, axis)
);

create trigger economic_component_classifications_household_scope_guard
before insert or update of household_id on public.economic_component_classifications
for each row execute function private.assert_history_v2_household_scope();

alter table public.economic_component_classifications enable row level security;
revoke all on table public.economic_component_classifications from PUBLIC, anon, authenticated;
grant all on table public.economic_component_classifications to service_role;

commit;
