-- P1 canonical physical MobilityTrip reconstruction.
-- Trip identity contains only household, method version and ordered canonical leg ids.
begin;

create table public.mobility_trips (
  mobility_trip_id uuid primary key,
  household_id uuid not null references public.households (household_id),
  start_date date not null,
  end_date date not null,
  started_at timestamp without time zone,
  ended_at timestamp without time zone,
  start_place_id uuid references public.referentiel_lieu (place_id),
  end_place_id uuid references public.referentiel_lieu (place_id),
  trip_shape text not null check (trip_shape in (
    'DIRECT', 'ROUND_TRIP', 'MULTI_STOP_CIRCUIT', 'LOCAL_LOOP', 'MULTI_DAY_JOURNEY', 'OPEN_CHAIN'
  )),
  boundary_status text not null check (boundary_status in (
    'CLOSED_HOME', 'CLOSED_SAME_ANCHOR', 'OPEN_START', 'OPEN_END', 'OPEN_BOTH',
    'WINDOW_TRUNCATED_START', 'WINDOW_TRUNCATED_END'
  )),
  formation_basis text not null check (formation_basis in (
    'SINGLETON', 'OBSERVED_TEMPORAL_CHAIN', 'UNIQUE_ENDPOINT_CHAIN',
    'DIRECT_SOURCE_CHAIN', 'AUTHORITATIVE_MULTI_DAY_BRIDGE', 'MIXED_AUTHORITATIVE_CHAIN'
  )),
  knowledge_state text not null check (knowledge_state in ('KNOWN', 'PARTIAL', 'CONFLICT')),
  reason_codes jsonb not null default '[]'::jsonb,
  method_version text not null check (method_version = 'mobility_trip_reconstruction@v1'),
  provenance jsonb not null,
  evidence_refs jsonb not null,
  source_revision bigint not null check (source_revision >= 0),
  is_active boolean not null default true,
  invalidated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobility_trips_dates_ordered check (start_date <= end_date),
  constraint mobility_trips_reason_codes_array check (jsonb_typeof(reason_codes) = 'array'),
  constraint mobility_trips_provenance_object check (jsonb_typeof(provenance) = 'object'),
  constraint mobility_trips_evidence_refs_array check (jsonb_typeof(evidence_refs) = 'array'),
  constraint mobility_trips_lifecycle_consistent check (
    (is_active and invalidated_at is null) or (not is_active and invalidated_at is not null)
  )
);

comment on table public.mobility_trips is
  'Deterministic physical chains of canonical MobilityLeg rows. Context, purpose, people and narrative are excluded.';
comment on column public.mobility_trips.mobility_trip_id is
  'UUIDv5 of household, method version and the ordered canonical MobilityLeg membership.';
comment on column public.mobility_trips.provenance is
  'Formation audit only. Trip costs remain derived sums of canonical MobilityLeg rows and are not persisted here.';

create table public.mobility_trip_legs (
  mobility_trip_leg_id uuid primary key,
  mobility_trip_id uuid not null references public.mobility_trips (mobility_trip_id) on delete restrict,
  mobility_leg_id uuid not null references public.mobility_legs (mobility_leg_id) on delete restrict,
  sequence_index integer not null check (sequence_index >= 0),
  membership_authority text not null check (membership_authority in (
    'TRIP_SEED', 'OBSERVED_TEMPORAL_CHAIN', 'UNIQUE_ENDPOINT_CHAIN',
    'DIRECT_SOURCE_CHAIN', 'AUTHORITATIVE_MULTI_DAY_BRIDGE'
  )),
  evidence_refs jsonb not null,
  source_revision bigint not null check (source_revision >= 0),
  is_active boolean not null default true,
  invalidated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobility_trip_legs_evidence_refs_array check (jsonb_typeof(evidence_refs) = 'array'),
  constraint mobility_trip_legs_lifecycle_consistent check (
    (is_active and invalidated_at is null) or (not is_active and invalidated_at is not null)
  )
);

comment on table public.mobility_trip_legs is
  'Versionable membership between physical MobilityTrip chains and immutable canonical MobilityLeg rows.';

create unique index mobility_trip_legs_one_active_trip_per_leg_idx
  on public.mobility_trip_legs (mobility_leg_id)
  where is_active;
create unique index mobility_trip_legs_active_sequence_idx
  on public.mobility_trip_legs (mobility_trip_id, sequence_index)
  where is_active;
create index mobility_trips_household_period_idx
  on public.mobility_trips (household_id, start_date, end_date)
  where is_active;
create index mobility_trip_legs_active_trip_idx
  on public.mobility_trip_legs (mobility_trip_id, sequence_index)
  where is_active;

create function private.assert_mobility_trip_leg_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.mobility_trips trip
    join public.mobility_legs leg on leg.mobility_leg_id = new.mobility_leg_id
    where trip.mobility_trip_id = new.mobility_trip_id
      and trip.household_id = leg.household_id
      and trip.source_revision = new.source_revision
  ) then
    raise exception 'MOBILITY_TRIP_LEG_SCOPE_MISMATCH' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger mobility_trip_legs_scope_guard
before insert or update of mobility_trip_id, mobility_leg_id, source_revision
on public.mobility_trip_legs
for each row execute function private.assert_mobility_trip_leg_scope();

create function private.rebuild_mobility_trips_v1()
returns table(
  trip_count bigint,
  membership_count bigint,
  unassigned_leg_count bigint,
  duplicate_membership_count bigint,
  partial_trip_count bigint,
  conflict_trip_count bigint,
  cross_month_trip_count bigint,
  build_hash text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_seed record;
  v_current record;
  v_next record;
  v_trip_no bigint := 0;
  v_sequence integer;
  v_candidate_count integer;
  v_min_observed timestamp without time zone;
  v_next_leg_id uuid;
  v_authority text;
  v_membership_evidence jsonb;
  v_trip_id uuid;
  v_now timestamptz := statement_timestamp();
begin
  create temporary table _p1_legs on commit drop as
  select
    leg.*,
    case
      when leg.origin_place_id is not null then 'place:' || lower(leg.origin_place_id::text)
      when leg.origin_source_label is not null
       and leg.origin_source_latitude is not null
       and leg.origin_source_longitude is not null
      then 'source:' || lower(btrim(leg.origin_source_label)) || '|'
        || leg.origin_source_latitude::text || '|' || leg.origin_source_longitude::text
      else null
    end as origin_endpoint_key,
    case
      when leg.destination_place_id is not null then 'place:' || lower(leg.destination_place_id::text)
      when leg.destination_source_label is not null
       and leg.destination_source_latitude is not null
       and leg.destination_source_longitude is not null
      then 'source:' || lower(btrim(leg.destination_source_label)) || '|'
        || leg.destination_source_latitude::text || '|' || leg.destination_source_longitude::text
      else null
    end as destination_endpoint_key,
    exists (
      select 1 from public.referentiel_lieu home
      where home.place_id = leg.origin_place_id
        and home.nature_lieu = 'Domicile privé'
        and home.usage_principal = 'Domicile'
        and home.sous_type = 'Domicile principal'
    ) as origin_is_home,
    exists (
      select 1 from public.referentiel_lieu home
      where home.place_id = leg.destination_place_id
        and home.nature_lieu = 'Domicile privé'
        and home.usage_principal = 'Domicile'
        and home.sous_type = 'Domicile principal'
    ) as destination_is_home,
    split_part(leg.source_leg_id, '-', 2)::integer as source_ordinal
  from public.mobility_legs leg;

  create unique index on _p1_legs (mobility_leg_id);
  create index on _p1_legs (household_id, vehicle_id, travel_date);
  create index on _p1_legs (origin_endpoint_key);

  create temporary table _p1_assignments (
    mobility_leg_id uuid primary key,
    trip_no bigint not null,
    sequence_index integer not null,
    membership_authority text not null,
    membership_evidence jsonb not null default '[]'::jsonb
  ) on commit drop;

  create temporary table _p1_trip_flags (
    trip_no bigint primary key,
    reason_codes text[] not null default array[]::text[]
  ) on commit drop;

  for v_seed in
    select leg.*
    from _p1_legs leg
    order by
      leg.travel_date,
      case when leg.time_authority = 'OBSERVED' then leg.observed_time end nulls last,
      leg.source_leg_id,
      leg.mobility_leg_id
  loop
    if exists (select 1 from _p1_assignments a where a.mobility_leg_id = v_seed.mobility_leg_id) then
      continue;
    end if;

    v_trip_no := v_trip_no + 1;
    v_sequence := 0;
    insert into _p1_trip_flags (trip_no) values (v_trip_no);
    insert into _p1_assignments (
      mobility_leg_id, trip_no, sequence_index, membership_authority, membership_evidence
    ) values (
      v_seed.mobility_leg_id, v_trip_no, v_sequence, 'TRIP_SEED', '[]'::jsonb
    );
    v_current := v_seed;

    loop
      exit when v_current.destination_is_home;
      v_candidate_count := 0;
      v_min_observed := null;
      v_authority := null;
      v_next_leg_id := null;
      v_membership_evidence := '[]'::jsonb;

      if v_current.destination_endpoint_key is not null
         and v_current.time_authority = 'OBSERVED'
         and v_current.observed_time is not null then
        select min(candidate.observed_time)
          into v_min_observed
        from _p1_legs candidate
        where candidate.household_id = v_current.household_id
          and candidate.vehicle_id = v_current.vehicle_id
          and candidate.travel_date = v_current.travel_date
          and candidate.origin_endpoint_key = v_current.destination_endpoint_key
          and candidate.time_authority = 'OBSERVED'
          and candidate.observed_time > v_current.observed_time
          and not exists (
            select 1 from _p1_assignments assigned
            where assigned.mobility_leg_id = candidate.mobility_leg_id
          );

        if v_min_observed is not null then
          select count(*), min(candidate.mobility_leg_id::text)::uuid
            into v_candidate_count, v_next_leg_id
          from _p1_legs candidate
          where candidate.household_id = v_current.household_id
            and candidate.vehicle_id = v_current.vehicle_id
            and candidate.travel_date = v_current.travel_date
            and candidate.origin_endpoint_key = v_current.destination_endpoint_key
            and candidate.time_authority = 'OBSERVED'
            and candidate.observed_time = v_min_observed
            and not exists (
              select 1 from _p1_assignments assigned
              where assigned.mobility_leg_id = candidate.mobility_leg_id
            );
          v_authority := 'OBSERVED_TEMPORAL_CHAIN';
        end if;
      end if;

      if v_candidate_count = 0 and v_current.destination_endpoint_key is not null then
        select count(*), min(candidate.mobility_leg_id::text)::uuid
          into v_candidate_count, v_next_leg_id
        from _p1_legs candidate
        where candidate.household_id = v_current.household_id
          and candidate.vehicle_id = v_current.vehicle_id
          and candidate.travel_date = v_current.travel_date
          and candidate.origin_endpoint_key = v_current.destination_endpoint_key
          and (
            v_current.time_authority <> 'OBSERVED'
            or candidate.time_authority <> 'OBSERVED'
            or candidate.observed_time > v_current.observed_time
          )
          and not exists (
            select 1 from _p1_assignments assigned
            where assigned.mobility_leg_id = candidate.mobility_leg_id
          );
        if v_candidate_count > 0 then
          v_authority := 'UNIQUE_ENDPOINT_CHAIN';
        end if;
      end if;

      if v_candidate_count = 0 and v_current.destination_endpoint_key is not null then
        select count(*), min(candidate.mobility_leg_id::text)::uuid
          into v_candidate_count, v_next_leg_id
        from _p1_legs candidate
        where candidate.household_id = v_current.household_id
          and candidate.vehicle_id = v_current.vehicle_id
          and candidate.source_reconstruction = v_current.source_reconstruction
          and candidate.source_group = v_current.source_group
          and candidate.source_ordinal = v_current.source_ordinal + 1
          and candidate.travel_date > v_current.travel_date
          and candidate.origin_endpoint_key = v_current.destination_endpoint_key
          and not exists (
            select 1 from _p1_assignments assigned
            where assigned.mobility_leg_id = candidate.mobility_leg_id
          );
        if v_candidate_count > 0 then
          v_authority := 'DIRECT_SOURCE_CHAIN';
          v_membership_evidence := jsonb_build_array(
            'mobility-source-chain:' || v_current.source_leg_id || '>'
              || (select source_leg_id from _p1_legs where mobility_leg_id = v_next_leg_id)
          );
        end if;
      end if;

      if v_candidate_count > 1 then
        update _p1_trip_flags
           set reason_codes = array_append(reason_codes, 'TRIP_AMBIGUOUS_NEXT_LEG')
         where trip_no = v_trip_no;
        exit;
      end if;

      if v_candidate_count = 0 then
        if v_current.destination_endpoint_key is null then
          update _p1_trip_flags
             set reason_codes = array_append(reason_codes, 'TRIP_ENDPOINT_GAP')
           where trip_no = v_trip_no;
        elsif exists (
          select 1
          from _p1_legs candidate
          where candidate.household_id = v_current.household_id
            and candidate.vehicle_id = v_current.vehicle_id
            and candidate.travel_date > v_current.travel_date
            and candidate.origin_endpoint_key = v_current.destination_endpoint_key
            and not exists (
              select 1 from _p1_assignments assigned
              where assigned.mobility_leg_id = candidate.mobility_leg_id
            )
        ) then
          update _p1_trip_flags
             set reason_codes = array_append(reason_codes, 'TRIP_OVERNIGHT_BRIDGE_UNPROVEN')
           where trip_no = v_trip_no;
        end if;
        exit;
      end if;

      select * into strict v_next
      from _p1_legs candidate
      where candidate.mobility_leg_id = v_next_leg_id;
      v_sequence := v_sequence + 1;
      insert into _p1_assignments (
        mobility_leg_id, trip_no, sequence_index, membership_authority, membership_evidence
      ) values (
        v_next.mobility_leg_id, v_trip_no, v_sequence, v_authority, v_membership_evidence
      );
      v_current := v_next;
    end loop;
  end loop;

  create temporary table _p1_built_trips on commit drop as
  with grouped as (
    select
      assignment.trip_no,
      min(leg.household_id::text)::uuid as household_id,
      min(leg.travel_date) as start_date,
      max(leg.travel_date) as end_date,
      string_agg(leg.mobility_leg_id::text, ',' order by assignment.sequence_index) as ordered_leg_ids,
      count(*) as leg_count,
      count(distinct assignment.membership_authority) filter (
        where assignment.membership_authority <> 'TRIP_SEED'
      ) as edge_authority_count,
      min(assignment.membership_authority) filter (
        where assignment.membership_authority <> 'TRIP_SEED'
      ) as single_edge_authority,
      bool_or(leg.origin_endpoint_key is null or leg.destination_endpoint_key is null) as has_endpoint_gap,
      coalesce(max(revision.data_revision), 0) as source_revision
    from _p1_assignments assignment
    join _p1_legs leg on leg.mobility_leg_id = assignment.mobility_leg_id
    left join public.household_revisions revision on revision.household_id = leg.household_id
    group by assignment.trip_no
  ), detailed as (
    select
      grouped.*,
      extensions.uuid_generate_v5(
        'ea6e8cf1-6c8e-5e20-aadc-63d879f04778'::uuid,
        grouped.household_id::text || '|mobility_trip_reconstruction@v1|' || grouped.ordered_leg_ids
      ) as mobility_trip_id,
      first_leg.observed_time as first_observed_time,
      first_leg.time_authority as first_time_authority,
      first_leg.time_type as first_time_type,
      first_leg.origin_place_id,
      first_leg.origin_endpoint_key,
      first_leg.origin_is_home,
      last_leg.observed_time as last_observed_time,
      last_leg.time_authority as last_time_authority,
      last_leg.time_type as last_time_type,
      last_leg.destination_place_id,
      last_leg.destination_endpoint_key,
      last_leg.destination_is_home,
      flags.reason_codes as formation_reason_codes
    from grouped
    join _p1_trip_flags flags on flags.trip_no = grouped.trip_no
    join lateral (
      select leg.*
      from _p1_assignments assignment
      join _p1_legs leg on leg.mobility_leg_id = assignment.mobility_leg_id
      where assignment.trip_no = grouped.trip_no
      order by assignment.sequence_index
      limit 1
    ) first_leg on true
    join lateral (
      select leg.*
      from _p1_assignments assignment
      join _p1_legs leg on leg.mobility_leg_id = assignment.mobility_leg_id
      where assignment.trip_no = grouped.trip_no
      order by assignment.sequence_index desc
      limit 1
    ) last_leg on true
  )
  select
    detailed.*,
    case
      when origin_is_home and destination_is_home then 'CLOSED_HOME'
      when origin_endpoint_key is not null and origin_endpoint_key = destination_endpoint_key then 'CLOSED_SAME_ANCHOR'
      when origin_is_home then 'OPEN_END'
      when destination_is_home then 'OPEN_START'
      else 'OPEN_BOTH'
    end as boundary_status
  from detailed;

  update public.mobility_trip_legs
     set is_active = false, invalidated_at = v_now, updated_at = v_now
   where is_active;
  update public.mobility_trips
     set is_active = false, invalidated_at = v_now, updated_at = v_now
   where is_active;

  insert into public.mobility_trips (
    mobility_trip_id, household_id, start_date, end_date, started_at, ended_at,
    start_place_id, end_place_id, trip_shape, boundary_status, formation_basis,
    knowledge_state, reason_codes, method_version, provenance, evidence_refs,
    source_revision, is_active, invalidated_at, created_at, updated_at
  )
  select
    built.mobility_trip_id,
    built.household_id,
    built.start_date,
    built.end_date,
    case
      when built.first_time_authority = 'OBSERVED' and built.first_time_type <> 'ARRIVAL'
      then built.first_observed_time
      else null
    end,
    case
      when built.last_time_authority = 'OBSERVED' and built.last_time_type <> 'DEPARTURE'
      then built.last_observed_time
      else null
    end,
    built.origin_place_id,
    built.destination_place_id,
    case
      when built.start_date <> built.end_date then 'MULTI_DAY_JOURNEY'
      when built.boundary_status = 'CLOSED_SAME_ANCHOR' then 'LOCAL_LOOP'
      when built.boundary_status = 'CLOSED_HOME' and built.leg_count = 2 then 'ROUND_TRIP'
      when built.boundary_status = 'CLOSED_HOME' and built.leg_count >= 3 then 'MULTI_STOP_CIRCUIT'
      when built.leg_count = 1 then 'DIRECT'
      else 'OPEN_CHAIN'
    end,
    built.boundary_status,
    case
      when built.edge_authority_count = 0 then 'SINGLETON'
      when built.edge_authority_count = 1 then built.single_edge_authority
      else 'MIXED_AUTHORITATIVE_CHAIN'
    end,
    case
      when 'TRIP_AMBIGUOUS_NEXT_LEG' = any(built.formation_reason_codes)
        or 'TRIP_SOURCE_LINEAGE_CONFLICT' = any(built.formation_reason_codes)
        or 'TRIP_VEHICLE_DISCONTINUITY' = any(built.formation_reason_codes)
      then 'CONFLICT'
      when built.boundary_status in ('OPEN_START', 'OPEN_END', 'OPEN_BOTH')
        or built.has_endpoint_gap
      then 'PARTIAL'
      else 'KNOWN'
    end,
    to_jsonb(array(
      select distinct reason
      from unnest(
        built.formation_reason_codes
        || case when built.boundary_status in ('OPEN_START', 'OPEN_BOTH') then array['TRIP_OPEN_START'] else array[]::text[] end
        || case when built.boundary_status in ('OPEN_END', 'OPEN_BOTH') then array['TRIP_OPEN_END'] else array[]::text[] end
        || case when built.has_endpoint_gap then array['TRIP_ENDPOINT_GAP'] else array[]::text[] end
      ) reason
      order by reason
    )),
    'mobility_trip_reconstruction@v1',
    jsonb_build_object(
      'authority', 'CANONICAL_MOBILITY_LEG_CHAIN',
      'orderedLegIdsHash', encode(extensions.digest(built.ordered_leg_ids, 'sha256'), 'hex'),
      'costAuthority', 'DERIVED_FROM_UNIQUE_CANONICAL_LEGS'
    ),
    coalesce((
      select jsonb_agg(distinct evidence.value order by evidence.value)
      from _p1_assignments assignment
      join _p1_legs leg on leg.mobility_leg_id = assignment.mobility_leg_id
      cross join lateral jsonb_array_elements_text(leg.evidence_refs) evidence(value)
      where assignment.trip_no = built.trip_no
    ), '[]'::jsonb),
    built.source_revision,
    true,
    null,
    v_now,
    v_now
  from _p1_built_trips built
  on conflict (mobility_trip_id) do update set
    household_id = excluded.household_id,
    start_date = excluded.start_date,
    end_date = excluded.end_date,
    started_at = excluded.started_at,
    ended_at = excluded.ended_at,
    start_place_id = excluded.start_place_id,
    end_place_id = excluded.end_place_id,
    trip_shape = excluded.trip_shape,
    boundary_status = excluded.boundary_status,
    formation_basis = excluded.formation_basis,
    knowledge_state = excluded.knowledge_state,
    reason_codes = excluded.reason_codes,
    provenance = excluded.provenance,
    evidence_refs = excluded.evidence_refs,
    source_revision = excluded.source_revision,
    is_active = true,
    invalidated_at = null,
    updated_at = excluded.updated_at;

  insert into public.mobility_trip_legs (
    mobility_trip_leg_id, mobility_trip_id, mobility_leg_id, sequence_index,
    membership_authority, evidence_refs, source_revision, is_active,
    invalidated_at, created_at, updated_at
  )
  select
    extensions.uuid_generate_v5(
      'cd1080bc-3f49-53c8-856d-067c26742dd9'::uuid,
      built.mobility_trip_id::text || '|' || assignment.mobility_leg_id::text
    ),
    built.mobility_trip_id,
    assignment.mobility_leg_id,
    assignment.sequence_index,
    assignment.membership_authority,
    (
      select jsonb_agg(distinct evidence.value order by evidence.value)
      from (
        select value from jsonb_array_elements_text(leg.evidence_refs)
        union all
        select value from jsonb_array_elements_text(assignment.membership_evidence)
      ) evidence(value)
    ),
    built.source_revision,
    true,
    null,
    v_now,
    v_now
  from _p1_assignments assignment
  join _p1_built_trips built on built.trip_no = assignment.trip_no
  join _p1_legs leg on leg.mobility_leg_id = assignment.mobility_leg_id
  on conflict (mobility_trip_leg_id) do update set
    mobility_trip_id = excluded.mobility_trip_id,
    mobility_leg_id = excluded.mobility_leg_id,
    sequence_index = excluded.sequence_index,
    membership_authority = excluded.membership_authority,
    evidence_refs = excluded.evidence_refs,
    source_revision = excluded.source_revision,
    is_active = true,
    invalidated_at = null,
    updated_at = excluded.updated_at;

  return query
  select
    (select count(*) from public.mobility_trips trip where trip.is_active),
    (select count(*) from public.mobility_trip_legs membership where membership.is_active),
    (
      select count(*)
      from public.mobility_legs leg
      where not exists (
        select 1 from public.mobility_trip_legs membership
        where membership.mobility_leg_id = leg.mobility_leg_id and membership.is_active
      )
    ),
    (
      select count(*)
      from (
        select membership.mobility_leg_id
        from public.mobility_trip_legs membership
        where membership.is_active
        group by membership.mobility_leg_id
        having count(*) > 1
      ) duplicate
    ),
    (select count(*) from public.mobility_trips trip where trip.is_active and trip.knowledge_state = 'PARTIAL'),
    (select count(*) from public.mobility_trips trip where trip.is_active and trip.knowledge_state = 'CONFLICT'),
    (
      select count(*) from public.mobility_trips trip
      where trip.is_active and date_trunc('month', trip.start_date) <> date_trunc('month', trip.end_date)
    ),
    (
      select encode(extensions.digest(string_agg(
        trip.mobility_trip_id::text || ':' || membership.mobility_leg_id::text || ':' || membership.sequence_index::text,
        ',' order by trip.mobility_trip_id, membership.sequence_index
      ), 'sha256'), 'hex')
      from public.mobility_trips trip
      join public.mobility_trip_legs membership on membership.mobility_trip_id = trip.mobility_trip_id
      where trip.is_active and membership.is_active
    );
end;
$$;

do $$
declare
  v_result record;
  v_active_leg_count bigint;
begin
  select count(*) into v_active_leg_count from public.mobility_legs;
  select * into strict v_result from private.rebuild_mobility_trips_v1();
  if v_result.membership_count <> v_active_leg_count
     or v_result.unassigned_leg_count <> 0
     or v_result.duplicate_membership_count <> 0 then
    raise exception 'MOBILITY_TRIP_RECONSTRUCTION_COVERAGE_FAILED: legs %, memberships %, unassigned %, duplicates %',
      v_active_leg_count, v_result.membership_count, v_result.unassigned_leg_count, v_result.duplicate_membership_count;
  end if;
end;
$$;

alter table public.mobility_trips enable row level security;
alter table public.mobility_trip_legs enable row level security;

revoke all on table public.mobility_trips from public, anon, authenticated;
revoke all on table public.mobility_trip_legs from public, anon, authenticated;
grant select, insert, update on table public.mobility_trips to service_role;
grant select, insert, update on table public.mobility_trip_legs to service_role;

revoke all on function private.assert_mobility_trip_leg_scope() from public, anon, authenticated;
revoke all on function private.rebuild_mobility_trips_v1() from public, anon, authenticated;
grant execute on function private.assert_mobility_trip_leg_scope() to service_role;
grant execute on function private.rebuild_mobility_trips_v1() to service_role;

commit;
