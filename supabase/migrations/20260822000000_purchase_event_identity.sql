begin;

create table public.purchase_events (
  purchase_event_id uuid primary key,
  household_id uuid not null references public.households (household_id)
);

create table public.purchase_event_sources (
  purchase_event_id uuid not null references public.purchase_events (purchase_event_id),
  operation_id uuid references public.operations (operation_id),
  cash_use_id uuid references public.cash_economic_uses (cash_use_id),
  constraint purchase_event_sources_source_xor
    check ((operation_id is not null) <> (cash_use_id is not null)),
  constraint purchase_event_sources_operation_unique unique (operation_id),
  constraint purchase_event_sources_cash_use_unique unique (cash_use_id)
);

commit;
