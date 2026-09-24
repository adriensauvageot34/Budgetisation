begin;

-- Existing bank batches keep their nullable bank account and their original
-- household/source/hash uniqueness. External sources supply an instance and
-- snapshot so that replay has a stable identity at the source boundary.
alter table public.import_batches
  add column source_instance_key text,
  add column source_snapshot_id text,
  add column coverage_status text,
  add constraint import_batches_external_identity_shape check (
    (source_instance_key is null and source_snapshot_id is null)
    or (nullif(btrim(source_instance_key), '') is not null
      and nullif(btrim(source_snapshot_id), '') is not null)
  ),
  add constraint import_batches_coverage_status_check check (
    coverage_status is null or coverage_status in ('FULL', 'PARTIAL', 'UNKNOWN')
  ),
  add constraint import_batches_id_household_unique unique (import_batch_id, household_id),
  add constraint import_batches_external_identity_unique unique (
    import_batch_id, household_id, source_system, source_instance_key, source_snapshot_id
  );

create unique index import_batches_external_snapshot_unique
  on public.import_batches (household_id, source_system, source_instance_key, source_snapshot_id)
  where source_instance_key is not null;

-- Person identity is already unique. This additional key lets wallet owner
-- references reject a person from a different Household by ordinary FK.
alter table public.persons
  add constraint persons_identity_household_unique unique (person_id, household_id);

create table public.external_source_records (
  external_source_record_id uuid primary key,
  household_id uuid not null references public.households (household_id),
  import_batch_id uuid not null,
  source_system text not null check (nullif(btrim(source_system), '') is not null),
  source_instance_key text not null check (nullif(btrim(source_instance_key), '') is not null),
  source_snapshot_id text not null check (nullif(btrim(source_snapshot_id), '') is not null),
  source_record_kind text not null check (source_record_kind in ('PURCHASE', 'CREDIT', 'OTHER')),
  source_native_id text,
  source_native_id_status text not null check (source_native_id_status in ('KNOWN', 'UNAVAILABLE')),
  source_fingerprint_sha256 text not null check (source_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  occurrence_ordinal integer not null check (occurrence_ordinal > 0),
  source_date date,
  source_time time without time zone,
  raw_payload jsonb not null check (jsonb_typeof(raw_payload) = 'object'),
  provenance text not null check (provenance in (
    'EXPLICIT_USER_ASSERTION', 'STRUCTURED_CANONICAL_SOURCE', 'CONTROLLED_BACKFILL'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_source_records_native_id_shape check (
    (source_native_id_status = 'KNOWN' and nullif(btrim(source_native_id), '') is not null)
    or (source_native_id_status = 'UNAVAILABLE' and source_native_id is null)
  ),
  constraint external_source_records_time_shape check (
    source_time is null or source_date is not null
  ),
  constraint external_source_records_batch_scope_fk foreign key (
    import_batch_id, household_id, source_system, source_instance_key, source_snapshot_id
  ) references public.import_batches (
    import_batch_id, household_id, source_system, source_instance_key, source_snapshot_id
  ),
  constraint external_source_records_id_household_unique unique (external_source_record_id, household_id),
  constraint external_source_records_replay_unique unique (
    household_id, source_system, source_instance_key, source_snapshot_id,
    source_fingerprint_sha256, occurrence_ordinal
  )
);

create index external_source_records_batch_lookup
  on public.external_source_records (household_id, import_batch_id);

create table public.benefit_wallets (
  benefit_wallet_id uuid primary key,
  household_id uuid not null references public.households (household_id),
  provider text not null check (nullif(btrim(provider), '') is not null),
  source_instance_key text not null check (nullif(btrim(source_instance_key), '') is not null),
  provider_wallet_external_id text,
  wallet_type text not null check (nullif(btrim(wallet_type), '') is not null),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  owner_person_id uuid,
  coverage_start date,
  coverage_end date,
  opening_balance numeric(18, 2),
  opening_balance_status text not null default 'UNKNOWN' check (
    opening_balance_status in ('KNOWN', 'UNKNOWN', 'CONFLICT')
  ),
  closing_balance numeric(18, 2),
  closing_balance_status text not null default 'UNKNOWN' check (
    closing_balance_status in ('KNOWN', 'UNKNOWN', 'CONFLICT')
  ),
  import_batch_id uuid,
  status text not null default 'UNKNOWN' check (status in ('ACTIVE', 'INACTIVE', 'UNKNOWN')),
  provenance text not null check (provenance in (
    'EXPLICIT_USER_ASSERTION', 'STRUCTURED_CANONICAL_SOURCE', 'CONTROLLED_BACKFILL'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint benefit_wallets_coverage_bounds check (
    coverage_start is null or coverage_end is null or coverage_end >= coverage_start
  ),
  constraint benefit_wallets_opening_balance_shape check (
    (opening_balance_status = 'KNOWN' and opening_balance is not null and opening_balance >= 0)
    or (opening_balance_status <> 'KNOWN' and opening_balance is null)
  ),
  constraint benefit_wallets_closing_balance_shape check (
    (closing_balance_status = 'KNOWN' and closing_balance is not null and closing_balance >= 0)
    or (closing_balance_status <> 'KNOWN' and closing_balance is null)
  ),
  constraint benefit_wallets_owner_scope_fk foreign key (owner_person_id, household_id)
    references public.persons (person_id, household_id),
  constraint benefit_wallets_import_batch_scope_fk foreign key (import_batch_id, household_id)
    references public.import_batches (import_batch_id, household_id),
  constraint benefit_wallets_id_household_currency_unique unique (benefit_wallet_id, household_id, currency)
);

create unique index benefit_wallets_external_identity_unique
  on public.benefit_wallets (household_id, provider, provider_wallet_external_id)
  where provider_wallet_external_id is not null;

-- A PurchaseEvent stores the one authoritative gross assertion. PARTIAL means
-- the numeric value is an observed lower-bound minimum, never an exact gross.
alter table public.purchase_events
  add column gross_amount numeric(18, 2),
  add column gross_amount_status text not null default 'UNKNOWN',
  add column gross_currency text not null default 'EUR',
  add column gross_source_record_id uuid,
  add column gross_evidence_refs jsonb not null default '[]'::jsonb,
  add constraint purchase_events_gross_status_check check (
    gross_amount_status in ('KNOWN', 'PARTIAL', 'UNKNOWN', 'CONFLICT')
  ),
  add constraint purchase_events_gross_shape check (
    (gross_amount_status in ('KNOWN', 'PARTIAL') and gross_amount is not null and gross_amount >= 0)
    or (gross_amount_status in ('UNKNOWN', 'CONFLICT') and gross_amount is null)
  ),
  add constraint purchase_events_gross_currency_check check (gross_currency ~ '^[A-Z]{3}$'),
  add constraint purchase_events_gross_evidence_array check (
    jsonb_typeof(gross_evidence_refs) = 'array'
  ),
  add constraint purchase_events_gross_source_scope_fk foreign key (gross_source_record_id, household_id)
    references public.external_source_records (external_source_record_id, household_id);

create unique index purchase_events_gross_source_unique
  on public.purchase_events (gross_source_record_id)
  where gross_source_record_id is not null;

create table public.purchase_economic_components (
  purchase_economic_component_id uuid primary key,
  household_id uuid not null references public.households (household_id),
  purchase_event_id uuid not null,
  canonical_component_key text generated always as (
    'purchase_component:' || purchase_economic_component_id::text
  ) stored,
  merchant_id uuid references public.merchants (merchant_id),
  category_id uuid references public.categories (category_id),
  subcategory_id uuid references public.subcategories (subcategory_id),
  need_id uuid references public.needs (need_id),
  provenance text not null check (provenance in (
    'EXPLICIT_USER_ASSERTION', 'STRUCTURED_CANONICAL_SOURCE', 'CONTROLLED_BACKFILL'
  )),
  created_at timestamptz not null default now(),
  constraint purchase_economic_components_event_scope_fk foreign key (purchase_event_id, household_id)
    references public.purchase_events (purchase_event_id, household_id) on delete cascade,
  constraint purchase_economic_components_event_unique unique (purchase_event_id),
  constraint purchase_economic_components_id_household_unique unique (
    purchase_economic_component_id, household_id
  ),
  constraint purchase_economic_components_event_scope_identity unique (
    purchase_economic_component_id, purchase_event_id, household_id
  )
);

create unique index purchase_economic_components_canonical_key_unique
  on public.purchase_economic_components (canonical_component_key);
create index purchase_economic_components_household_event_lookup
  on public.purchase_economic_components (household_id, purchase_event_id);

create table public.purchase_funding_components (
  purchase_funding_component_id uuid primary key,
  household_id uuid not null references public.households (household_id),
  purchase_event_id uuid not null,
  component_ordinal integer not null check (component_ordinal > 0),
  funding_kind text not null check (funding_kind in ('BENEFIT_WALLET', 'BANK_CARD', 'OTHER')),
  amount numeric(18, 2),
  amount_status text not null check (amount_status in ('KNOWN', 'PARTIAL', 'UNKNOWN', 'CONFLICT')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  benefit_wallet_id uuid,
  bank_operation_id uuid references public.operations (operation_id),
  external_source_record_id uuid,
  provenance text not null check (provenance in (
    'EXPLICIT_USER_ASSERTION', 'STRUCTURED_CANONICAL_SOURCE', 'CONTROLLED_BACKFILL'
  )),
  created_at timestamptz not null default now(),
  constraint purchase_funding_components_event_scope_fk foreign key (purchase_event_id, household_id)
    references public.purchase_events (purchase_event_id, household_id) on delete cascade,
  constraint purchase_funding_components_wallet_scope_fk foreign key (benefit_wallet_id, household_id, currency)
    references public.benefit_wallets (benefit_wallet_id, household_id, currency),
  constraint purchase_funding_components_source_scope_fk foreign key (external_source_record_id, household_id)
    references public.external_source_records (external_source_record_id, household_id),
  constraint purchase_funding_components_kind_shape check (
    (funding_kind = 'BENEFIT_WALLET' and benefit_wallet_id is not null and bank_operation_id is null)
    or (funding_kind = 'BANK_CARD' and benefit_wallet_id is null and bank_operation_id is not null)
    or (funding_kind = 'OTHER' and benefit_wallet_id is null and bank_operation_id is null)
  ),
  constraint purchase_funding_components_amount_shape check (
    (amount_status in ('KNOWN', 'PARTIAL') and amount is not null and amount >= 0)
    or (amount_status in ('UNKNOWN', 'CONFLICT') and amount is null)
  ),
  constraint purchase_funding_components_ordinal_unique unique (purchase_event_id, component_ordinal),
  constraint purchase_funding_components_event_scope_identity unique (
    purchase_funding_component_id, purchase_event_id, household_id
  )
);

create index purchase_funding_components_household_event_lookup
  on public.purchase_funding_components (household_id, purchase_event_id);
create index purchase_funding_components_wallet_lookup
  on public.purchase_funding_components (benefit_wallet_id)
  where benefit_wallet_id is not null;
create index purchase_funding_components_bank_operation_lookup
  on public.purchase_funding_components (bank_operation_id)
  where bank_operation_id is not null;

create table public.benefit_wallet_ledger_entries (
  benefit_wallet_ledger_entry_id uuid primary key,
  household_id uuid not null references public.households (household_id),
  benefit_wallet_id uuid not null,
  external_source_record_id uuid not null,
  entry_ordinal integer not null check (entry_ordinal > 0),
  entry_kind text not null check (entry_kind in ('CREDIT', 'PURCHASE_DEBIT')),
  amount numeric(18, 2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  event_date date not null,
  event_time time without time zone,
  external_entry_id text,
  purchase_event_id uuid,
  purchase_funding_component_id uuid,
  provenance text not null check (provenance in (
    'EXPLICIT_USER_ASSERTION', 'STRUCTURED_CANONICAL_SOURCE', 'CONTROLLED_BACKFILL'
  )),
  created_at timestamptz not null default now(),
  constraint benefit_wallet_ledger_wallet_scope_fk foreign key (benefit_wallet_id, household_id, currency)
    references public.benefit_wallets (benefit_wallet_id, household_id, currency),
  constraint benefit_wallet_ledger_source_scope_fk foreign key (external_source_record_id, household_id)
    references public.external_source_records (external_source_record_id, household_id),
  constraint benefit_wallet_ledger_event_scope_fk foreign key (purchase_event_id, household_id)
    references public.purchase_events (purchase_event_id, household_id),
  constraint benefit_wallet_ledger_funding_scope_fk foreign key (
    purchase_funding_component_id, purchase_event_id, household_id
  ) references public.purchase_funding_components (
    purchase_funding_component_id, purchase_event_id, household_id
  ),
  constraint benefit_wallet_ledger_kind_shape check (
    (entry_kind = 'CREDIT' and purchase_event_id is null and purchase_funding_component_id is null)
    or (entry_kind = 'PURCHASE_DEBIT' and
      (purchase_funding_component_id is null or purchase_event_id is not null))
  ),
  constraint benefit_wallet_ledger_replay_unique unique (
    benefit_wallet_id, external_source_record_id, entry_kind, entry_ordinal
  )
);

create index benefit_wallet_ledger_wallet_date_lookup
  on public.benefit_wallet_ledger_entries (benefit_wallet_id, event_date);
create index benefit_wallet_ledger_source_lookup
  on public.benefit_wallet_ledger_entries (external_source_record_id);
create index benefit_wallet_ledger_purchase_lookup
  on public.benefit_wallet_ledger_entries (purchase_event_id)
  where purchase_event_id is not null;

create table public.purchase_event_channel_assertions (
  purchase_event_channel_assertion_id uuid primary key,
  household_id uuid not null references public.households (household_id),
  purchase_event_id uuid not null,
  channel text not null check (channel in ('DIRECT_OR_IN_PERSON', 'UBER_EATS', 'UNKNOWN')),
  status text not null check (status in ('KNOWN', 'UNKNOWN', 'CONFLICT')),
  evidence_refs jsonb not null default '[]'::jsonb,
  provenance text not null check (provenance in (
    'EXPLICIT_USER_ASSERTION', 'STRUCTURED_CANONICAL_SOURCE', 'CONTROLLED_BACKFILL'
  )),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint purchase_event_channel_event_scope_fk foreign key (purchase_event_id, household_id)
    references public.purchase_events (purchase_event_id, household_id) on delete cascade,
  constraint purchase_event_channel_evidence_shape check (
    jsonb_typeof(evidence_refs) = 'array'
    and (status = 'UNKNOWN' or jsonb_array_length(evidence_refs) > 0)
  ),
  constraint purchase_event_channel_status_shape check (
    (status = 'KNOWN' and channel <> 'UNKNOWN')
    or (status in ('UNKNOWN', 'CONFLICT') and channel = 'UNKNOWN')
  )
);

create unique index purchase_event_channel_active_unique
  on public.purchase_event_channel_assertions (purchase_event_id) where is_active;
create index purchase_event_channel_household_event_lookup
  on public.purchase_event_channel_assertions (household_id, purchase_event_id);

-- Rebuild only the two generated keys whose expression must recognize the
-- purchase-native source. Catalog inspection found no view dependency on
-- either generated column; each table is empty in the certified C0 baseline.
drop index public.purchase_event_consumption_owner_unique;
alter table public.purchase_event_memberships
  drop constraint purchase_event_memberships_event_source_unique,
  drop constraint purchase_event_memberships_source_xor,
  drop column canonical_component_key,
  add column purchase_economic_component_id uuid,
  add column canonical_component_key text generated always as (
    case
      when operation_id is not null then 'operation:' || operation_id::text
      when allocation_id is not null then 'allocation:' || allocation_id::text
      when item_id is not null then 'item:' || item_id::text
      when payment_component_id is not null then 'payment_component:' || payment_component_id::text
      when cash_use_id is not null then 'cash_use:' || cash_use_id::text
      when purchase_economic_component_id is not null
        then 'purchase_component:' || purchase_economic_component_id::text
    end
  ) stored,
  add constraint purchase_event_memberships_source_xor check (
    num_nonnulls(operation_id, allocation_id, item_id, payment_component_id,
      cash_use_id, purchase_economic_component_id) = 1
  ),
  add constraint purchase_event_memberships_purchase_owner_kind check (
    purchase_economic_component_id is null or membership_kind = 'CONSUMPTION_COMPONENT'
  ),
  add constraint purchase_event_memberships_purchase_component_scope_fk foreign key (
    purchase_economic_component_id, purchase_event_id, household_id
  ) references public.purchase_economic_components (
    purchase_economic_component_id, purchase_event_id, household_id
  ),
  add constraint purchase_event_memberships_event_source_unique unique (
    purchase_event_id, membership_kind, canonical_component_key
  );

create unique index purchase_event_consumption_owner_unique
  on public.purchase_event_memberships (canonical_component_key)
  where membership_kind = 'CONSUMPTION_COMPONENT';
create unique index purchase_event_one_consumption_owner_unique
  on public.purchase_event_memberships (purchase_event_id)
  where membership_kind = 'CONSUMPTION_COMPONENT';
create index purchase_event_memberships_purchase_component_lookup
  on public.purchase_event_memberships (purchase_economic_component_id)
  where purchase_economic_component_id is not null;

alter table public.economic_component_classifications
  drop constraint economic_component_classifications_component_axis_unique,
  drop constraint economic_component_classifications_source_xor,
  drop column canonical_component_key,
  add column purchase_economic_component_id uuid,
  add column canonical_component_key text generated always as (
    case
      when operation_id is not null then 'operation:' || operation_id::text
      when allocation_id is not null then 'allocation:' || allocation_id::text
      when item_id is not null then 'item:' || item_id::text
      when payment_component_id is not null then 'payment_component:' || payment_component_id::text
      when cash_use_id is not null then 'cash_use:' || cash_use_id::text
      when purchase_economic_component_id is not null
        then 'purchase_component:' || purchase_economic_component_id::text
    end
  ) stored,
  add constraint economic_component_classifications_source_xor check (
    num_nonnulls(operation_id, allocation_id, item_id, payment_component_id,
      cash_use_id, purchase_economic_component_id) = 1
  ),
  add constraint economic_component_classifications_purchase_component_scope_fk foreign key (
    purchase_economic_component_id, household_id
  ) references public.purchase_economic_components (
    purchase_economic_component_id, household_id
  ),
  add constraint economic_component_classifications_component_axis_unique unique (
    household_id, canonical_component_key, axis
  );

create index economic_component_classifications_purchase_component_lookup
  on public.economic_component_classifications (purchase_economic_component_id)
  where purchase_economic_component_id is not null;

-- A PurchaseEvent cannot commit with zero or several effective owners. The
-- deferred check permits parent and membership creation in one transaction.
create function private.assert_purchase_event_one_owner(p_event_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_count integer;
begin
  if not exists (select 1 from public.purchase_events where purchase_event_id = p_event_id) then
    return;
  end if;
  select count(*) into owner_count
  from public.purchase_event_memberships
  where purchase_event_id = p_event_id
    and membership_kind = 'CONSUMPTION_COMPONENT';
  if owner_count <> 1 then
    raise exception using errcode = '23514',
      message = 'PurchaseEvent requires exactly one consumption owner.';
  end if;
end;
$$;

create function private.assert_purchase_event_one_owner_trigger()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_table_name = 'purchase_events' then
    perform private.assert_purchase_event_one_owner(new.purchase_event_id);
    return new;
  end if;
  if tg_op = 'DELETE' then
    perform private.assert_purchase_event_one_owner(old.purchase_event_id);
    return old;
  end if;
  if tg_op = 'UPDATE' and old.purchase_event_id is distinct from new.purchase_event_id then
    perform private.assert_purchase_event_one_owner(old.purchase_event_id);
  end if;
  perform private.assert_purchase_event_one_owner(new.purchase_event_id);
  return new;
end;
$$;

revoke all on function private.assert_purchase_event_one_owner(uuid) from PUBLIC, anon, authenticated;
revoke all on function private.assert_purchase_event_one_owner_trigger() from PUBLIC, anon, authenticated;
grant execute on function private.assert_purchase_event_one_owner(uuid) to service_role;
grant execute on function private.assert_purchase_event_one_owner_trigger() to service_role;

create constraint trigger purchase_events_one_owner_guard
  after insert or update on public.purchase_events
  deferrable initially deferred
  for each row execute function private.assert_purchase_event_one_owner_trigger();
create constraint trigger purchase_event_memberships_one_owner_guard
  after insert or update or delete on public.purchase_event_memberships
  deferrable initially deferred
  for each row execute function private.assert_purchase_event_one_owner_trigger();

-- A purchase-native component is an owner, not an unused parallel row beside
-- an Operation owner. It must be the effective membership of its PurchaseEvent.
create function private.assert_purchase_native_component_membership()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.purchase_event_memberships
    where purchase_event_id = new.purchase_event_id
      and purchase_economic_component_id = new.purchase_economic_component_id
      and membership_kind = 'CONSUMPTION_COMPONENT'
  ) then
    raise exception using errcode = '23514',
      message = 'Purchase-native component must be the effective consumption owner.';
  end if;
  return new;
end;
$$;

revoke all on function private.assert_purchase_native_component_membership() from PUBLIC, anon, authenticated;
grant execute on function private.assert_purchase_native_component_membership() to service_role;
create constraint trigger purchase_native_component_membership_guard
  after insert or update on public.purchase_economic_components
  deferrable initially deferred
  for each row execute function private.assert_purchase_native_component_membership();

-- A wallet debit linked to a FundingComponent must point to the same wallet
-- and to a known Benefit funding amount. Credits never have an economic link.
create function private.assert_benefit_wallet_ledger_link()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  linked_funding record;
  source_kind text;
begin
  select source_record_kind into source_kind
  from public.external_source_records
  where external_source_record_id = new.external_source_record_id;
  if (new.entry_kind = 'CREDIT' and source_kind is distinct from 'CREDIT')
    or (new.entry_kind = 'PURCHASE_DEBIT' and source_kind is distinct from 'PURCHASE') then
    raise exception using errcode = '23514',
      message = 'Wallet ledger kind conflicts with source record kind.';
  end if;
  if new.purchase_funding_component_id is not null then
    select funding_kind, benefit_wallet_id, amount_status, amount
      into linked_funding
    from public.purchase_funding_components
    where purchase_funding_component_id = new.purchase_funding_component_id;
    if linked_funding.funding_kind is distinct from 'BENEFIT_WALLET'
      or linked_funding.benefit_wallet_id is distinct from new.benefit_wallet_id
      or linked_funding.amount_status is distinct from 'KNOWN'
      or linked_funding.amount is distinct from new.amount then
      raise exception using errcode = '23514',
        message = 'Wallet debit must match its Benefit funding component.';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.assert_benefit_wallet_ledger_link() from PUBLIC, anon, authenticated;
grant execute on function private.assert_benefit_wallet_ledger_link() to service_role;
create trigger benefit_wallet_ledger_link_guard
  before insert or update of external_source_record_id, entry_kind, purchase_funding_component_id,
    purchase_event_id, benefit_wallet_id, amount
  on public.benefit_wallet_ledger_entries
  for each row execute function private.assert_benefit_wallet_ledger_link();

-- New public tables follow the existing service-only Canonical posture.
create trigger external_source_records_household_scope_guard
  before insert or update of household_id on public.external_source_records
  for each row execute function private.assert_history_v2_household_scope();
create trigger benefit_wallets_household_scope_guard
  before insert or update of household_id on public.benefit_wallets
  for each row execute function private.assert_history_v2_household_scope();
create trigger purchase_economic_components_household_scope_guard
  before insert or update of household_id on public.purchase_economic_components
  for each row execute function private.assert_history_v2_household_scope();
create trigger purchase_funding_components_household_scope_guard
  before insert or update of household_id on public.purchase_funding_components
  for each row execute function private.assert_history_v2_household_scope();
create trigger benefit_wallet_ledger_household_scope_guard
  before insert or update of household_id on public.benefit_wallet_ledger_entries
  for each row execute function private.assert_history_v2_household_scope();
create trigger purchase_event_channel_household_scope_guard
  before insert or update of household_id on public.purchase_event_channel_assertions
  for each row execute function private.assert_history_v2_household_scope();

alter table public.external_source_records enable row level security;
alter table public.benefit_wallets enable row level security;
alter table public.benefit_wallet_ledger_entries enable row level security;
alter table public.purchase_funding_components enable row level security;
alter table public.purchase_economic_components enable row level security;
alter table public.purchase_event_channel_assertions enable row level security;

revoke all on table public.external_source_records from PUBLIC, anon, authenticated;
revoke all on table public.benefit_wallets from PUBLIC, anon, authenticated;
revoke all on table public.benefit_wallet_ledger_entries from PUBLIC, anon, authenticated;
revoke all on table public.purchase_funding_components from PUBLIC, anon, authenticated;
revoke all on table public.purchase_economic_components from PUBLIC, anon, authenticated;
revoke all on table public.purchase_event_channel_assertions from PUBLIC, anon, authenticated;
grant all on table public.external_source_records to service_role;
grant all on table public.benefit_wallets to service_role;
grant all on table public.benefit_wallet_ledger_entries to service_role;
grant all on table public.purchase_funding_components to service_role;
grant all on table public.purchase_economic_components to service_role;
grant all on table public.purchase_event_channel_assertions to service_role;

commit;
