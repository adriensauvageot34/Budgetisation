-- P4.5-A Canonical Mobility foundation. Prepared only: explicit human approval
-- is required before applying this migration or importing source rows.
begin;

create table public.mobility_datasets (
  dataset_id uuid primary key,
  household_id uuid not null references public.households (household_id),
  source_name text not null check (length(btrim(source_name)) > 0),
  period_start date not null,
  period_end date not null,
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  import_method_version text not null check (import_method_version ~ '^canonical_mobility_xlsx@[v][0-9]+$'),
  source_leg_count integer not null check (source_leg_count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobility_datasets_period_order check (period_start <= period_end),
  constraint mobility_datasets_household_source_unique
    unique (household_id, source_hash, import_method_version),
  constraint mobility_datasets_household_identity_unique
    unique (dataset_id, household_id)
);

comment on table public.mobility_datasets is
  'Canonical identity and lineage for one idempotently imported mobility source dataset.';

create table public.mobility_legs (
  mobility_leg_id uuid primary key,
  source_leg_id text not null check (source_leg_id ~ '^(NAV|JOUR|AUT)-[0-9]{4}$'),
  dataset_id uuid not null,
  household_id uuid not null references public.households (household_id),
  vehicle_id uuid not null references public.vehicles (vehicle_id),
  travel_date date not null,

  origin_place_id uuid references public.referentiel_lieu (place_id),
  destination_place_id uuid references public.referentiel_lieu (place_id),
  origin_source_label text,
  destination_source_label text,
  origin_source_latitude numeric(12, 8),
  origin_source_longitude numeric(12, 8),
  destination_source_latitude numeric(12, 8),
  destination_source_longitude numeric(12, 8),
  origin_resolution_state text not null check (origin_resolution_state in ('EXPLICIT_MAPPING', 'UNRESOLVED')),
  destination_resolution_state text not null check (destination_resolution_state in ('EXPLICIT_MAPPING', 'UNRESOLVED')),

  distance_km numeric(20, 9) not null check (distance_km >= 0),
  duration_seconds numeric(20, 6) check (duration_seconds >= 0),
  duration_no_traffic_seconds numeric(20, 6) check (duration_no_traffic_seconds >= 0),
  estimated_fuel_liters numeric(20, 9) not null check (estimated_fuel_liters >= 0),
  estimated_fuel_cost numeric(20, 9) not null check (estimated_fuel_cost >= 0),

  fuel_type text not null check (fuel_type = 'SP95'),
  fuel_price_per_liter numeric(12, 6) not null check (fuel_price_per_liter > 0),
  fuel_price_period date not null check (extract(day from fuel_price_period) = 1),
  fuel_price_geo_scope text not null check (fuel_price_geo_scope in ('LOCAL_DEPARTMENT', 'NATIONAL')),
  fuel_price_source text not null check (length(btrim(fuel_price_source)) > 0),
  fuel_price_quality text not null check (fuel_price_quality in ('P3_LOCAL_DEPARTMENT', 'P4_NATIONAL_FALLBACK')),
  fuel_price_observation_id uuid references public.fuel_price_observations (fuel_price_observation_id),

  consumption_model_ref text not null check (length(btrim(consumption_model_ref)) > 0),
  route_method_ref text not null check (length(btrim(route_method_ref)) > 0),
  observed_time timestamp without time zone,
  time_authority text not null check (time_authority in ('OBSERVED', 'PROXY', 'UNKNOWN')),
  time_type text not null check (time_type in ('DEPARTURE', 'ARRIVAL', 'UNTYPED', 'UNKNOWN')),
  route_time_basis text,
  route_proxy_times jsonb not null default '[]'::jsonb,

  source_group text not null check (source_group in ('NAV', 'JOUR', 'AUT')),
  source_reconstruction text not null check (length(btrim(source_reconstruction)) > 0),
  source_sheet text not null check (length(btrim(source_sheet)) > 0),
  source_quality text not null check (length(btrim(source_quality)) > 0),
  status text not null check (status in ('CERTIFIED_SOURCE', 'SOURCE_PARTIAL')),
  confidence text not null check (confidence in ('HIGH', 'MEDIUM', 'LOW', 'UNKNOWN')),
  method_version text not null check (length(btrim(method_version)) > 0),
  source_row_hash text not null check (source_row_hash ~ '^[0-9a-f]{64}$'),
  provenance jsonb not null,
  evidence_refs jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint mobility_legs_dataset_household_fk
    foreign key (dataset_id, household_id)
    references public.mobility_datasets (dataset_id, household_id)
    on delete restrict,
  constraint mobility_legs_dataset_source_unique unique (dataset_id, source_leg_id),
  constraint mobility_legs_source_group_consistent check (
    source_group = split_part(source_leg_id, '-', 1)
  ),
  constraint mobility_legs_fuel_authority_consistent check (
    (fuel_price_quality = 'P3_LOCAL_DEPARTMENT' and fuel_price_geo_scope = 'LOCAL_DEPARTMENT')
    or (fuel_price_quality = 'P4_NATIONAL_FALLBACK' and fuel_price_geo_scope = 'NATIONAL')
  ),
  constraint mobility_legs_time_authority_consistent check (
    (time_authority = 'OBSERVED' and observed_time is not null)
    or (time_authority in ('PROXY', 'UNKNOWN') and observed_time is null)
  ),
  constraint mobility_legs_source_coordinates_valid check (
    (origin_source_latitude is null or origin_source_latitude between -90 and 90)
    and (destination_source_latitude is null or destination_source_latitude between -90 and 90)
    and (origin_source_longitude is null or origin_source_longitude between -180 and 180)
    and (destination_source_longitude is null or destination_source_longitude between -180 and 180)
  ),
  constraint mobility_legs_origin_resolution_consistent check (
    (origin_resolution_state = 'EXPLICIT_MAPPING' and origin_place_id is not null)
    or (origin_resolution_state = 'UNRESOLVED' and origin_place_id is null)
  ),
  constraint mobility_legs_destination_resolution_consistent check (
    (destination_resolution_state = 'EXPLICIT_MAPPING' and destination_place_id is not null)
    or (destination_resolution_state = 'UNRESOLVED' and destination_place_id is null)
  ),
  constraint mobility_legs_proxy_times_array check (jsonb_typeof(route_proxy_times) = 'array'),
  constraint mobility_legs_provenance_object check (jsonb_typeof(provenance) = 'object'),
  constraint mobility_legs_evidence_array check (jsonb_typeof(evidence_refs) = 'array')
);

comment on table public.mobility_legs is
  'One physical movement of one vehicle from one endpoint to another. Participants and business context are separate future relations.';
comment on column public.mobility_legs.estimated_fuel_cost is
  'Estimated fuel consumed by this unique physical leg; never a bank payment or economic operation.';
comment on column public.mobility_legs.source_group is
  'Technical reconstruction lineage NAV/JOUR/AUT, never a business purpose.';

create index mobility_legs_household_date_idx
  on public.mobility_legs (household_id, travel_date, mobility_leg_id);
create index mobility_legs_dataset_idx
  on public.mobility_legs (dataset_id, source_leg_id);
create index mobility_legs_vehicle_date_idx
  on public.mobility_legs (vehicle_id, travel_date, mobility_leg_id);
create index mobility_legs_fuel_price_observation_idx
  on public.mobility_legs (fuel_price_observation_id)
  where fuel_price_observation_id is not null;
create index mobility_legs_origin_place_idx
  on public.mobility_legs (origin_place_id) where origin_place_id is not null;
create index mobility_legs_destination_place_idx
  on public.mobility_legs (destination_place_id) where destination_place_id is not null;

create function private.assert_mobility_leg_household_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.mobility_datasets dataset
    where dataset.dataset_id = new.dataset_id
      and dataset.household_id = new.household_id
  ) then
    raise exception 'MOBILITY_DATASET_HOUSEHOLD_SCOPE_MISMATCH';
  end if;
  if not exists (
    select 1 from public.vehicles vehicle
    where vehicle.vehicle_id = new.vehicle_id
      and vehicle.household_id = new.household_id
  ) then
    raise exception 'MOBILITY_VEHICLE_HOUSEHOLD_SCOPE_MISMATCH';
  end if;
  return new;
end;
$$;

create trigger mobility_legs_household_scope_guard
before insert or update of dataset_id, household_id, vehicle_id
on public.mobility_legs
for each row execute function private.assert_mobility_leg_household_scope();

alter table public.mobility_datasets enable row level security;
alter table public.mobility_legs enable row level security;

revoke all on table public.mobility_datasets from public, anon, authenticated;
revoke all on table public.mobility_legs from public, anon, authenticated;
grant select, insert, update on table public.mobility_datasets to service_role;
grant select, insert, update on table public.mobility_legs to service_role;

revoke all on function private.assert_mobility_leg_household_scope() from public, anon, authenticated;
grant execute on function private.assert_mobility_leg_household_scope() to service_role;

commit;
