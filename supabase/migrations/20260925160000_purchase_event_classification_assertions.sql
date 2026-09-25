begin;

-- Purchase evidence belongs to the PurchaseEvent, even when its economic
-- owner is an existing Operation. Component classification remains separate.
create table public.purchase_event_classification_assertions (
  purchase_event_classification_assertion_id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (household_id),
  purchase_event_id uuid not null,
  axis text not null check (axis in ('NECESSITY', 'BEHAVIOR', 'LIFE_SCOPE')),
  status text not null check (status in ('KNOWN', 'UNKNOWN', 'CONFLICT')),
  value text,
  authority text check (authority in ('EXPLICIT_COMPONENT_OVERRIDE', 'AUTHORITATIVE_COMPONENT_SOURCE', 'OPERATION_FALLBACK')),
  evidence_refs jsonb not null default '[]'::jsonb,
  provenance text not null check (provenance in (
    'EXPLICIT_USER_ASSERTION', 'STRUCTURED_CANONICAL_SOURCE', 'CONTROLLED_BACKFILL'
  )),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint purchase_event_classification_event_household_fk
    foreign key (purchase_event_id, household_id)
    references public.purchase_events (purchase_event_id, household_id)
    on delete cascade,
  constraint purchase_event_classification_value_shape check (
    (status = 'KNOWN' and authority is not null and value is not null)
    or (status = 'CONFLICT' and authority is not null and value is null)
    or (status = 'UNKNOWN' and value is null)
  ),
  constraint purchase_event_classification_axis_value check (
    value is null
    or (axis = 'NECESSITY' and value in ('Indispensable', 'Contraint', 'Optionnel'))
    or (axis = 'BEHAVIOR' and value in ('Fixe', 'Variable'))
    or (axis = 'LIFE_SCOPE' and value in ('Vie courante', 'Hors quotidien'))
  ),
  constraint purchase_event_classification_evidence_array check (
    jsonb_typeof(evidence_refs) = 'array'
    and (status = 'UNKNOWN' or jsonb_array_length(evidence_refs) > 0)
  )
);

create unique index purchase_event_classification_active_unique
  on public.purchase_event_classification_assertions (purchase_event_id, axis)
  where is_active;
create index purchase_event_classification_household_event_lookup
  on public.purchase_event_classification_assertions (household_id, purchase_event_id);

create trigger purchase_event_classification_household_scope_guard
  before insert or update of household_id on public.purchase_event_classification_assertions
  for each row execute function private.assert_history_v2_household_scope();

alter table public.purchase_event_classification_assertions enable row level security;
revoke all on table public.purchase_event_classification_assertions from PUBLIC, anon, authenticated;
grant all on table public.purchase_event_classification_assertions to service_role;

commit;
