begin;

create table public.life_event_continuity_assertions (
  life_event_id uuid primary key references public.life_events (life_event_id) on delete cascade,
  household_id uuid not null references public.households (household_id),
  status text not null check (status in ('KNOWN', 'UNKNOWN', 'CONFLICT')),
  continuity_qualifier text check (continuity_qualifier in ('CONTINUOUS', 'NOT_CONTINUOUS')),
  authority text,
  evidence_refs jsonb not null default '[]'::jsonb,
  provenance text not null check (provenance in ('EXPLICIT_USER_ASSERTION', 'STRUCTURED_CANONICAL_SOURCE', 'CONTROLLED_BACKFILL')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint life_event_continuity_value_shape check (
    (status = 'KNOWN' and continuity_qualifier is not null and authority is not null)
    or (status = 'CONFLICT' and continuity_qualifier is null and authority is not null)
    or (status = 'UNKNOWN' and continuity_qualifier is null)
  ),
  constraint life_event_continuity_evidence_array check (
    jsonb_typeof(evidence_refs) = 'array'
    and (status = 'UNKNOWN' or jsonb_array_length(evidence_refs) > 0)
  )
);

create trigger life_event_continuity_household_scope_guard
before insert or update of household_id on public.life_event_continuity_assertions
for each row execute function private.assert_history_v2_household_scope();

alter table public.life_event_continuity_assertions enable row level security;
revoke all on table public.life_event_continuity_assertions from PUBLIC, anon, authenticated;
grant all on table public.life_event_continuity_assertions to service_role;

commit;
