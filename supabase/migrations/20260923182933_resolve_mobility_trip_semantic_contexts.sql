-- P2 semantic TripContext reconstruction. Physical Trip membership and measures are immutable inputs.
begin;

create table public.mobility_trip_context_links (
  mobility_trip_context_link_id uuid primary key,
  household_id uuid not null references public.households (household_id),
  mobility_trip_id uuid not null references public.mobility_trips (mobility_trip_id) on delete restrict,
  life_event_id uuid references public.life_events (life_event_id) on delete restrict,
  moment_id uuid references public.moments (moment_id) on delete restrict,
  relation_type text not null check (relation_type in (
    'PRIMARY_CONTEXT', 'ENVELOPING_CONTEXT', 'DESTINATION_CONTEXT', 'ORIGIN_CONTEXT',
    'STOP_CONTEXT', 'ACCESS_CONTEXT', 'ASSOCIATED_CONTEXT'
  )),
  anchor_leg_id uuid references public.mobility_legs (mobility_leg_id) on delete restrict,
  anchor_place_id uuid references public.referentiel_lieu (place_id) on delete restrict,
  link_method text not null check (link_method in (
    'EXACT_PLACE_TIME', 'EXACT_PLACE_DATE', 'ENCLOSING_MOMENT',
    'CONFIRMED_MOMENT_LIFE_EVENT', 'ROUTINE_ACTIVITY_MATCH',
    'ACCESS_TO_MOMENT', 'EXPLICIT_ASSERTION'
  )),
  validation_status text not null check (validation_status in ('CONFIRMED', 'DERIVED')),
  authority text not null,
  provenance jsonb not null,
  evidence_refs jsonb not null,
  source_revision bigint not null check (source_revision >= 0),
  is_active boolean not null default true,
  invalidated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobility_trip_context_links_exactly_one_target check (
    (life_event_id is not null)::integer + (moment_id is not null)::integer = 1
  ),
  constraint mobility_trip_context_links_provenance_array check (jsonb_typeof(provenance) = 'array'),
  constraint mobility_trip_context_links_evidence_array check (jsonb_typeof(evidence_refs) = 'array'),
  constraint mobility_trip_context_links_lifecycle check (
    (is_active and invalidated_at is null) or (not is_active and invalidated_at is not null)
  ),
  constraint mobility_trip_context_links_anchor_pair check (
    (anchor_leg_id is null and anchor_place_id is null)
    or (anchor_leg_id is not null and anchor_place_id is not null)
  ),
  constraint mobility_trip_context_links_moment_relation check (
    moment_id is null or relation_type in ('ENVELOPING_CONTEXT', 'ACCESS_CONTEXT', 'ASSOCIATED_CONTEXT')
  )
);

comment on table public.mobility_trip_context_links is
  'Versionable semantic links from a physical MobilityTrip to exactly one LifeEvent or Moment. Never stores allocation or monetary measures.';
comment on column public.mobility_trip_context_links.relation_type is
  'Narrative relation only; it cannot alter Trip identity, membership, distance, fuel or cost.';

create table public.mobility_trip_context_resolutions (
  mobility_trip_context_resolution_id uuid primary key,
  household_id uuid not null references public.households (household_id),
  mobility_trip_id uuid not null references public.mobility_trips (mobility_trip_id) on delete restrict,
  resolution_status text not null check (resolution_status in ('RESOLVED', 'UNRESOLVED', 'CONFLICT')),
  reason_codes jsonb not null,
  method_version text not null check (method_version = 'mobility_trip_context@v1'),
  build_hash text not null,
  provenance jsonb not null,
  source_revision bigint not null check (source_revision >= 0),
  is_active boolean not null default true,
  invalidated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobility_trip_context_resolutions_reason_array check (jsonb_typeof(reason_codes) = 'array'),
  constraint mobility_trip_context_resolutions_provenance_array check (jsonb_typeof(provenance) = 'array'),
  constraint mobility_trip_context_resolutions_lifecycle check (
    (is_active and invalidated_at is null) or (not is_active and invalidated_at is not null)
  )
);

create unique index mobility_trip_context_links_active_life_event_idx
  on public.mobility_trip_context_links (
    mobility_trip_id, life_event_id, relation_type, anchor_leg_id, anchor_place_id
  ) nulls not distinct
  where is_active and life_event_id is not null;
create unique index mobility_trip_context_links_active_moment_idx
  on public.mobility_trip_context_links (
    mobility_trip_id, moment_id, relation_type, anchor_leg_id, anchor_place_id
  ) nulls not distinct
  where is_active and moment_id is not null;
create unique index mobility_trip_context_resolutions_active_trip_idx
  on public.mobility_trip_context_resolutions (mobility_trip_id)
  where is_active;
create index mobility_trip_context_links_household_trip_idx
  on public.mobility_trip_context_links (household_id, mobility_trip_id)
  where is_active;
create index mobility_trip_context_links_household_fk_idx
  on public.mobility_trip_context_links (household_id);
create index mobility_trip_context_links_trip_fk_idx
  on public.mobility_trip_context_links (mobility_trip_id);
create index mobility_trip_context_links_life_event_fk_idx
  on public.mobility_trip_context_links (life_event_id)
  where life_event_id is not null;
create index mobility_trip_context_links_moment_fk_idx
  on public.mobility_trip_context_links (moment_id)
  where moment_id is not null;
create index mobility_trip_context_links_anchor_leg_fk_idx
  on public.mobility_trip_context_links (anchor_leg_id)
  where anchor_leg_id is not null;
create index mobility_trip_context_links_anchor_place_fk_idx
  on public.mobility_trip_context_links (anchor_place_id)
  where anchor_place_id is not null;
create index mobility_trip_context_resolutions_household_idx
  on public.mobility_trip_context_resolutions (household_id)
  where is_active;
create index mobility_trip_context_resolutions_household_fk_idx
  on public.mobility_trip_context_resolutions (household_id);
create index mobility_trip_context_resolutions_trip_fk_idx
  on public.mobility_trip_context_resolutions (mobility_trip_id);

create function private.assert_mobility_trip_context_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.mobility_trips trip
    where trip.mobility_trip_id = new.mobility_trip_id
      and trip.household_id = new.household_id
  ) then
    raise exception 'MOBILITY_TRIP_CONTEXT_TRIP_SCOPE_MISMATCH' using errcode = '23514';
  end if;
  if new.moment_id is not null and not exists (
    select 1 from public.moments moment
    where moment.moment_id = new.moment_id and moment.household_id = new.household_id
  ) then
    raise exception 'MOBILITY_TRIP_CONTEXT_MOMENT_SCOPE_MISMATCH' using errcode = '23514';
  end if;
  if new.life_event_id is not null and not exists (
    select 1 from public.timeline_event_semantic_assertions assertion
    where assertion.life_event_id = new.life_event_id
      and assertion.household_id = new.household_id
      and assertion.is_active
      and assertion.validated_at is not null
  ) then
    raise exception 'MOBILITY_TRIP_CONTEXT_EVENT_SCOPE_MISMATCH' using errcode = '23514';
  end if;
  if new.anchor_leg_id is not null and not exists (
    select 1
    from public.mobility_trip_legs membership
    join public.mobility_legs leg on leg.mobility_leg_id = membership.mobility_leg_id
    where membership.mobility_trip_id = new.mobility_trip_id
      and membership.mobility_leg_id = new.anchor_leg_id
      and membership.is_active
      and new.anchor_place_id in (leg.origin_place_id, leg.destination_place_id)
  ) then
    raise exception 'MOBILITY_TRIP_CONTEXT_ANCHOR_SCOPE_MISMATCH' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger mobility_trip_context_links_scope_guard
before insert or update of household_id, mobility_trip_id, life_event_id, moment_id, anchor_leg_id, anchor_place_id
on public.mobility_trip_context_links
for each row execute function private.assert_mobility_trip_context_scope();

create function private.assert_mobility_trip_context_resolution_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.mobility_trips trip
    where trip.mobility_trip_id = new.mobility_trip_id
      and trip.household_id = new.household_id
  ) then
    raise exception 'MOBILITY_TRIP_CONTEXT_RESOLUTION_SCOPE_MISMATCH' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger mobility_trip_context_resolutions_scope_guard
before insert or update of household_id, mobility_trip_id
on public.mobility_trip_context_resolutions
for each row execute function private.assert_mobility_trip_context_resolution_scope();

create function private.rebuild_mobility_trip_contexts_v1()
returns table (
  trip_count bigint,
  trips_with_context bigint,
  trips_without_context bigint,
  trip_context_link_count bigint,
  moment_link_count bigint,
  life_event_link_count bigint,
  primary_context_count bigint,
  conflict_count bigint,
  build_hash text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_build_hash text;
begin
  create temporary table _p2_event_places on commit drop as
  select distinct event_place.life_event_id, event_place.place_id, event_place.place_role, event_place.occurrence_type
  from (
    select event.life_event_id, event.primary_place_id as place_id,
      'Principal'::text as place_role, 'Présence'::text as occurrence_type
    from public.life_events event
    where event.primary_place_id is not null
    union all
    select localization.life_event_id, occurrence.place_id,
      localization.role as place_role, occurrence.occurrence_type
    from public.life_event_localizations localization
    join public.location_occurrences occurrence
      on occurrence.localization_id = localization.localization_id
    where localization.location_certainty in ('Confirmée', 'Déduite')
  ) event_place;
  create index on _p2_event_places (life_event_id, place_id);

  create temporary table _p2_candidates on commit drop as
  with trip_legs as (
    select
      trip.mobility_trip_id,
      trip.household_id,
      trip.start_date,
      trip.end_date,
      trip.boundary_status,
      trip.source_revision,
      membership.mobility_leg_id,
      membership.sequence_index,
      max(membership.sequence_index) over (partition by trip.mobility_trip_id) as last_sequence_index,
      leg.travel_date,
      leg.origin_place_id,
      leg.destination_place_id,
      leg.observed_time,
      leg.time_authority,
      leg.time_type,
      leg.evidence_refs,
      household.timezone
    from public.mobility_trips trip
    join public.mobility_trip_legs membership
      on membership.mobility_trip_id = trip.mobility_trip_id and membership.is_active
    join public.mobility_legs leg on leg.mobility_leg_id = membership.mobility_leg_id
    join public.households household on household.household_id = trip.household_id
    where trip.is_active
  ), assessed as (
    select distinct
      trip_leg.mobility_trip_id,
      trip_leg.household_id,
      trip_leg.mobility_leg_id,
      trip_leg.sequence_index,
      trip_leg.last_sequence_index,
      trip_leg.travel_date,
      trip_leg.boundary_status,
      trip_leg.source_revision,
      event.life_event_id,
      event_place.place_id as anchor_place_id,
      event_place.place_role,
      event_place.occurrence_type,
      event.validation_status as event_validation_status,
      case
        when trip_leg.time_type = 'ARRIVAL' then 'ARRIVAL_TO_CONTEXT'
        when trip_leg.time_type = 'DEPARTURE' then 'DEPARTURE_FROM_CONTEXT'
        else 'WITHIN_CONTEXT'
      end as temporal_relation,
      case
        when trip_leg.time_authority = 'OBSERVED'
         and participation.time_precision = 'Exact'
         and participation.start_at is not null
         and participation.end_at is not null
         and case
           when trip_leg.time_type = 'ARRIVAL' then
             trip_leg.observed_time at time zone trip_leg.timezone
               between participation.start_at - interval '120 minutes' and participation.end_at
           when trip_leg.time_type = 'DEPARTURE' then
             trip_leg.observed_time at time zone trip_leg.timezone
               between participation.start_at and participation.end_at + interval '120 minutes'
           else
             trip_leg.observed_time at time zone trip_leg.timezone
               between participation.start_at and participation.end_at
         end
        then 'EXACT_PLACE_TIME'
        when trip_leg.time_authority = 'OBSERVED'
         and event.validation_status = 'Confirmé'
         and (participation.start_at is null or participation.end_at is null)
        then 'EXACT_PLACE_DATE'
        when trip_leg.time_authority = 'PROXY'
         and event.validation_status = 'Confirmé'
         and (event_place.place_role in ('Départ', 'Arrivée') or event_place.occurrence_type = 'Transit')
        then 'ACCESS_PROXY_CANDIDATE'
        else null
      end as assessment,
      jsonb_build_array(
        'fct_mobility_leg:' || trip_leg.mobility_leg_id::text,
        'life-event:' || event.life_event_id::text,
        'life-event-place:' || event.life_event_id::text || ':' || event_place.place_id::text,
        'life-event-participation:' || participation.participation_id::text,
        'global_m7_mobility_context@v1'
      ) as evidence_refs
    from trip_legs trip_leg
    join public.life_events event
      on trip_leg.travel_date between event.start_date and event.end_date
     and event.validation_status in ('Confirmé', 'Déduit')
    join _p2_event_places event_place on event_place.life_event_id = event.life_event_id
     and (
       (trip_leg.time_type = 'ARRIVAL' and event_place.place_id = trip_leg.destination_place_id)
       or (trip_leg.time_type = 'DEPARTURE' and event_place.place_id = trip_leg.origin_place_id)
       or (trip_leg.time_type = 'UNTYPED' and event_place.place_id in (
         trip_leg.origin_place_id, trip_leg.destination_place_id
       ))
     )
    join public.life_event_participations participation
      on participation.life_event_id = event.life_event_id
     and participation.participation_status in ('Confirmée', 'Déduite')
  )
  select
    assessed.*,
    case
      when assessed.temporal_relation = 'ARRIVAL_TO_CONTEXT'
       and assessed.sequence_index = assessed.last_sequence_index then 'DESTINATION_CONTEXT'
      when assessed.temporal_relation = 'DEPARTURE_FROM_CONTEXT'
       and assessed.sequence_index = 0
       and assessed.boundary_status not in ('CLOSED_HOME', 'CLOSED_SAME_ANCHOR') then 'ORIGIN_CONTEXT'
      else 'STOP_CONTEXT'
    end as candidate_relation_type,
    (assessed.place_role in ('Départ', 'Arrivée') or assessed.occurrence_type = 'Transit') as is_access,
    assessed.assessment = 'ACCESS_PROXY_CANDIDATE' as moment_only,
    case
      when assessed.assessment = 'EXACT_PLACE_TIME' and assessed.event_validation_status = 'Confirmé'
        then 'CONFIRMED'
      else 'DERIVED'
    end as candidate_validation_status,
    case when assessed.assessment = 'ACCESS_PROXY_CANDIDATE'
      then 'EXACT_PLACE_DATE' else assessed.assessment end as candidate_link_method
  from assessed
  where assessed.assessment is not null;
  create index on _p2_candidates (mobility_trip_id, life_event_id);

  create temporary table _p2_eligible_moments on commit drop as
  select distinct
    candidate.mobility_trip_id,
    candidate.household_id,
    candidate.life_event_id,
    moment.moment_id,
    candidate.mobility_leg_id,
    candidate.anchor_place_id,
    candidate.sequence_index,
    candidate.travel_date,
    candidate.is_access,
    candidate.candidate_validation_status,
    candidate.source_revision,
    moment.start_date as moment_start_date,
    moment.end_date as moment_end_date,
    link.relation_type as hierarchy_relation_type,
    link.validation_status as hierarchy_validation_status,
    link.moment_life_event_id,
    candidate.evidence_refs,
    assertion.timeline_event_semantic_assertion_id
  from _p2_candidates candidate
  join public.moment_life_events link on link.life_event_id = candidate.life_event_id
   and link.validation_status in ('Confirmé', 'Déduit')
  join public.moments moment on moment.moment_id = link.moment_id
   and moment.household_id = candidate.household_id
   and moment.start_date is not null and moment.end_date is not null
  join public.mobility_trips trip on trip.mobility_trip_id = candidate.mobility_trip_id
   and moment.start_date <= trip.start_date and moment.end_date >= trip.end_date
  join public.timeline_event_semantic_assertions assertion on assertion.moment_id = moment.moment_id
   and assertion.household_id = candidate.household_id
   and assertion.is_active and assertion.validated_at is not null;

  create temporary table _p2_ambiguous_event_hierarchies on commit drop as
  select mobility_trip_id, life_event_id
  from _p2_eligible_moments
  group by mobility_trip_id, life_event_id
  having count(distinct moment_id) > 1;

  create temporary table _p2_selected_moment_events on commit drop as
  select eligible.*
  from _p2_eligible_moments eligible
  where not exists (
    select 1 from _p2_ambiguous_event_hierarchies ambiguous
    where ambiguous.mobility_trip_id = eligible.mobility_trip_id
      and ambiguous.life_event_id = eligible.life_event_id
  );

  create temporary table _p2_built_links (
    mobility_trip_context_link_id uuid primary key,
    household_id uuid not null,
    mobility_trip_id uuid not null,
    life_event_id uuid,
    moment_id uuid,
    relation_type text not null,
    anchor_leg_id uuid,
    anchor_place_id uuid,
    link_method text not null,
    validation_status text not null,
    authority text not null,
    provenance jsonb not null,
    evidence_refs jsonb not null,
    source_revision bigint not null
  ) on commit drop;

  insert into _p2_built_links
  with grouped as (
    select
      selected.mobility_trip_id,
      min(selected.household_id::text)::uuid as household_id,
      selected.moment_id,
      bool_or(selected.is_access and selected.travel_date in (
        selected.moment_start_date, selected.moment_end_date
      )) as is_access,
      (array_agg(selected.mobility_leg_id order by
        case when selected.is_access and selected.travel_date in (
          selected.moment_start_date, selected.moment_end_date
        ) then 0 else 1 end,
        selected.sequence_index, selected.mobility_leg_id
      ))[1] as anchor_leg_id,
      (array_agg(selected.anchor_place_id order by
        case when selected.is_access and selected.travel_date in (
          selected.moment_start_date, selected.moment_end_date
        ) then 0 else 1 end,
        selected.sequence_index, selected.mobility_leg_id
      ))[1] as anchor_place_id,
      bool_and(selected.candidate_validation_status = 'CONFIRMED'
        and selected.hierarchy_validation_status = 'Confirmé') as fully_confirmed,
      max(selected.source_revision) as source_revision,
      jsonb_agg(distinct evidence.value order by evidence.value) as evidence_refs
    from _p2_selected_moment_events selected
    cross join lateral jsonb_array_elements_text(
      selected.evidence_refs || jsonb_build_array(
        'moment:' || selected.moment_id::text,
        'moment-life-event:' || selected.moment_life_event_id::text,
        'timeline-semantic-assertion:' || selected.timeline_event_semantic_assertion_id::text
      )
    ) evidence(value)
    group by selected.mobility_trip_id, selected.moment_id
  ), normalized as (
    select grouped.*,
      case when grouped.is_access then 'ACCESS_CONTEXT' else 'ENVELOPING_CONTEXT' end as relation_type,
      case when grouped.is_access then 'ACCESS_TO_MOMENT' else 'CONFIRMED_MOMENT_LIFE_EVENT' end as link_method
    from grouped
  )
  select
    extensions.uuid_generate_v5(
      '9389ed84-af5c-5a38-8425-3b6ce4f76187'::uuid,
      normalized.household_id::text || '|mobility_trip_context@v1|'
        || normalized.mobility_trip_id::text || '|moment:' || normalized.moment_id::text || '|'
        || normalized.relation_type || '|'
        || case when normalized.is_access then normalized.anchor_leg_id::text else '' end || '|'
        || case when normalized.is_access then normalized.anchor_place_id::text else '' end
    ),
    normalized.household_id,
    normalized.mobility_trip_id,
    null::uuid,
    normalized.moment_id,
    normalized.relation_type,
    case when normalized.is_access then normalized.anchor_leg_id else null end,
    case when normalized.is_access then normalized.anchor_place_id else null end,
    normalized.link_method,
    case when normalized.fully_confirmed then 'CONFIRMED' else 'DERIVED' end,
    'MOMENT_LIFE_EVENT + M7_MOBILITY_CONTEXT',
    jsonb_build_array('mobility_trip_context@v1', 'global_m7_mobility_context@v1'),
    normalized.evidence_refs,
    normalized.source_revision
  from normalized;

  insert into _p2_built_links
  with remaining as (
    select candidate.*
    from _p2_candidates candidate
    where not candidate.moment_only
      and exists (
        select 1 from public.timeline_event_semantic_assertions assertion
        where assertion.life_event_id = candidate.life_event_id
          and assertion.household_id = candidate.household_id
          and assertion.is_active and assertion.validated_at is not null
      )
      and not exists (
        select 1 from _p2_selected_moment_events represented
        where represented.mobility_trip_id = candidate.mobility_trip_id
          and represented.life_event_id = candidate.life_event_id
          and represented.hierarchy_relation_type <> 'Composant'
      )
  ), event_counts as (
    select mobility_trip_id, count(distinct life_event_id) as event_count
    from remaining
    group by mobility_trip_id
  ), normalized as (
    select remaining.*,
      case
        when event_counts.event_count = 1
         and remaining.candidate_relation_type = 'DESTINATION_CONTEXT'
         and remaining.candidate_link_method = 'EXACT_PLACE_TIME'
         and remaining.candidate_validation_status = 'CONFIRMED'
        then 'PRIMARY_CONTEXT'
        else remaining.candidate_relation_type
      end as relation_type
    from remaining
    join event_counts using (mobility_trip_id)
  ), grouped as (
    select
      normalized.mobility_trip_id,
      normalized.household_id,
      normalized.life_event_id,
      normalized.relation_type,
      normalized.mobility_leg_id as anchor_leg_id,
      normalized.anchor_place_id,
      min(normalized.candidate_link_method) as link_method,
      case when bool_or(normalized.candidate_validation_status = 'CONFIRMED')
        then 'CONFIRMED' else 'DERIVED' end as validation_status,
      max(normalized.source_revision) as source_revision,
      jsonb_agg(distinct evidence.value order by evidence.value) as evidence_refs
    from normalized
    cross join lateral jsonb_array_elements_text(normalized.evidence_refs) evidence(value)
    group by normalized.mobility_trip_id, normalized.household_id, normalized.life_event_id,
      normalized.relation_type, normalized.mobility_leg_id, normalized.anchor_place_id
  )
  select
    extensions.uuid_generate_v5(
      '9389ed84-af5c-5a38-8425-3b6ce4f76187'::uuid,
      grouped.household_id::text || '|mobility_trip_context@v1|'
        || grouped.mobility_trip_id::text || '|life-event:' || grouped.life_event_id::text || '|'
        || grouped.relation_type || '|' || grouped.anchor_leg_id::text || '|'
        || grouped.anchor_place_id::text
    ),
    grouped.household_id,
    grouped.mobility_trip_id,
    grouped.life_event_id,
    null::uuid,
    grouped.relation_type,
    grouped.anchor_leg_id,
    grouped.anchor_place_id,
    grouped.link_method,
    grouped.validation_status,
    'M7_MOBILITY_CONTEXT + TRIP_LEVEL_RESOLUTION',
    jsonb_build_array('mobility_trip_context@v1', 'global_m7_mobility_context@v1'),
    grouped.evidence_refs,
    grouped.source_revision
  from grouped;

  create temporary table _p2_resolution_reasons on commit drop as
  select trip.mobility_trip_id, 'CONTEXT_TRIP_PARTIAL_BOUNDARY'::text as reason_code
  from public.mobility_trips trip
  where trip.is_active and (
    trip.boundary_status like 'OPEN_%' or trip.boundary_status like 'WINDOW_TRUNCATED_%'
  )
  union
  select trip.mobility_trip_id, 'NO_SEMANTIC_CONTEXT_CANDIDATE'
  from public.mobility_trips trip
  where trip.is_active and not exists (
    select 1 from _p2_built_links link where link.mobility_trip_id = trip.mobility_trip_id
  )
  union
  select distinct represented.mobility_trip_id, 'CONTEXT_ALREADY_REPRESENTED_BY_MOMENT'
  from _p2_selected_moment_events represented
  union
  select distinct ambiguous.mobility_trip_id, 'CONTEXT_HIERARCHY_AMBIGUOUS'
  from _p2_ambiguous_event_hierarchies ambiguous
  union
  select candidate.mobility_trip_id, 'MULTIPLE_PRIMARY_CONTEXT_CANDIDATES'
  from _p2_candidates candidate
  where candidate.candidate_relation_type = 'DESTINATION_CONTEXT'
    and candidate.candidate_link_method = 'EXACT_PLACE_TIME'
    and candidate.candidate_validation_status = 'CONFIRMED'
  group by candidate.mobility_trip_id
  having count(distinct candidate.life_event_id) > 1
  union
  select distinct candidate.mobility_trip_id, 'CONTEXT_ACCESS_RELATION_UNPROVEN'
  from _p2_candidates candidate
  join public.moment_life_events hierarchy on hierarchy.life_event_id = candidate.life_event_id
   and hierarchy.validation_status in ('Confirmé', 'Déduit')
  join public.moments moment on moment.moment_id = hierarchy.moment_id
  where candidate.is_access
    and candidate.travel_date not in (moment.start_date, moment.end_date)
  union
  select distinct candidate.mobility_trip_id, 'NO_NARRATIVE_SEMANTIC_ASSERTION'
  from _p2_candidates candidate
  join public.moment_life_events hierarchy on hierarchy.life_event_id = candidate.life_event_id
   and hierarchy.validation_status in ('Confirmé', 'Déduit')
  join public.moments moment on moment.moment_id = hierarchy.moment_id
   and moment.household_id = candidate.household_id
  join public.mobility_trips trip on trip.mobility_trip_id = candidate.mobility_trip_id
   and moment.start_date <= trip.start_date and moment.end_date >= trip.end_date
  where not exists (
    select 1 from public.timeline_event_semantic_assertions assertion
    where assertion.moment_id = moment.moment_id
      and assertion.household_id = candidate.household_id
      and assertion.is_active and assertion.validated_at is not null
  );

  select encode(extensions.digest(coalesce(string_agg(
    link.mobility_trip_context_link_id::text || ':' || link.relation_type || ':'
      || coalesce(link.life_event_id::text, link.moment_id::text),
    ',' order by link.mobility_trip_context_link_id
  ), ''), 'sha256'), 'hex')
  into v_build_hash
  from _p2_built_links link;

  update public.mobility_trip_context_links existing
  set is_active = false, invalidated_at = v_now, updated_at = v_now
  where existing.is_active and not exists (
    select 1 from _p2_built_links built
    where built.mobility_trip_context_link_id = existing.mobility_trip_context_link_id
  );

  insert into public.mobility_trip_context_links (
    mobility_trip_context_link_id, household_id, mobility_trip_id, life_event_id, moment_id,
    relation_type, anchor_leg_id, anchor_place_id, link_method, validation_status,
    authority, provenance, evidence_refs, source_revision, is_active, invalidated_at,
    created_at, updated_at
  )
  select built.*, true, null, v_now, v_now
  from _p2_built_links built
  on conflict (mobility_trip_context_link_id) do update set
    household_id = excluded.household_id,
    mobility_trip_id = excluded.mobility_trip_id,
    life_event_id = excluded.life_event_id,
    moment_id = excluded.moment_id,
    relation_type = excluded.relation_type,
    anchor_leg_id = excluded.anchor_leg_id,
    anchor_place_id = excluded.anchor_place_id,
    link_method = excluded.link_method,
    validation_status = excluded.validation_status,
    authority = excluded.authority,
    provenance = excluded.provenance,
    evidence_refs = excluded.evidence_refs,
    source_revision = excluded.source_revision,
    is_active = true,
    invalidated_at = null,
    updated_at = excluded.updated_at;

  update public.mobility_trip_context_resolutions existing
  set is_active = false, invalidated_at = v_now, updated_at = v_now
  where existing.is_active and not exists (
    select 1 from public.mobility_trips trip
    where trip.mobility_trip_id = existing.mobility_trip_id and trip.is_active
  );

  insert into public.mobility_trip_context_resolutions (
    mobility_trip_context_resolution_id, household_id, mobility_trip_id,
    resolution_status, reason_codes, method_version, build_hash, provenance,
    source_revision, is_active, invalidated_at, created_at, updated_at
  )
  select
    extensions.uuid_generate_v5(
      '4ce65b0b-ac32-53eb-b79f-bcf2dbf82ea8'::uuid,
      trip.household_id::text || '|mobility_trip_context@v1|' || trip.mobility_trip_id::text
    ),
    trip.household_id,
    trip.mobility_trip_id,
    case
      when exists (
        select 1 from _p2_ambiguous_event_hierarchies conflict
        where conflict.mobility_trip_id = trip.mobility_trip_id
      ) then 'CONFLICT'
      when exists (
        select 1 from _p2_built_links link where link.mobility_trip_id = trip.mobility_trip_id
      ) then 'RESOLVED'
      else 'UNRESOLVED'
    end,
    coalesce((
      select jsonb_agg(reason.reason_code order by reason.reason_code)
      from _p2_resolution_reasons reason
      where reason.mobility_trip_id = trip.mobility_trip_id
    ), '[]'::jsonb),
    'mobility_trip_context@v1',
    v_build_hash,
    jsonb_build_array('mobility_trip_context@v1', 'global_m7_mobility_context@v1'),
    trip.source_revision,
    true,
    null,
    v_now,
    v_now
  from public.mobility_trips trip
  where trip.is_active
  on conflict (mobility_trip_context_resolution_id) do update set
    household_id = excluded.household_id,
    mobility_trip_id = excluded.mobility_trip_id,
    resolution_status = excluded.resolution_status,
    reason_codes = excluded.reason_codes,
    build_hash = excluded.build_hash,
    provenance = excluded.provenance,
    source_revision = excluded.source_revision,
    is_active = true,
    invalidated_at = null,
    updated_at = excluded.updated_at;

  return query
  select
    count(*)::bigint,
    count(*) filter (where exists (
      select 1 from public.mobility_trip_context_links link
      where link.mobility_trip_id = trip.mobility_trip_id and link.is_active
    ))::bigint,
    count(*) filter (where not exists (
      select 1 from public.mobility_trip_context_links link
      where link.mobility_trip_id = trip.mobility_trip_id and link.is_active
    ))::bigint,
    (select count(*) from public.mobility_trip_context_links link where link.is_active),
    (select count(*) from public.mobility_trip_context_links link where link.is_active and link.moment_id is not null),
    (select count(*) from public.mobility_trip_context_links link where link.is_active and link.life_event_id is not null),
    (select count(*) from public.mobility_trip_context_links link where link.is_active and link.relation_type = 'PRIMARY_CONTEXT'),
    (select count(*) from public.mobility_trip_context_resolutions resolution where resolution.is_active and resolution.resolution_status = 'CONFLICT'),
    v_build_hash
  from public.mobility_trips trip
  where trip.is_active;
end;
$$;

do $$
declare
  v_before_trip_hash text;
  v_before_membership_hash text;
  v_after_trip_hash text;
  v_after_membership_hash text;
  v_result record;
begin
  select encode(extensions.digest(coalesce(string_agg(
    trip.mobility_trip_id::text || ':' || trip.source_revision::text,
    ',' order by trip.mobility_trip_id
  ), ''), 'sha256'), 'hex')
  into v_before_trip_hash
  from public.mobility_trips trip where trip.is_active;

  select encode(extensions.digest(coalesce(string_agg(
    membership.mobility_trip_id::text || ':' || membership.mobility_leg_id::text || ':'
      || membership.sequence_index::text,
    ',' order by membership.mobility_trip_id, membership.sequence_index
  ), ''), 'sha256'), 'hex')
  into v_before_membership_hash
  from public.mobility_trip_legs membership where membership.is_active;

  select * into strict v_result from private.rebuild_mobility_trip_contexts_v1();

  select encode(extensions.digest(coalesce(string_agg(
    trip.mobility_trip_id::text || ':' || trip.source_revision::text,
    ',' order by trip.mobility_trip_id
  ), ''), 'sha256'), 'hex')
  into v_after_trip_hash
  from public.mobility_trips trip where trip.is_active;

  select encode(extensions.digest(coalesce(string_agg(
    membership.mobility_trip_id::text || ':' || membership.mobility_leg_id::text || ':'
      || membership.sequence_index::text,
    ',' order by membership.mobility_trip_id, membership.sequence_index
  ), ''), 'sha256'), 'hex')
  into v_after_membership_hash
  from public.mobility_trip_legs membership where membership.is_active;

  if v_before_trip_hash <> v_after_trip_hash or v_before_membership_hash <> v_after_membership_hash then
    raise exception 'MOBILITY_TRIP_CONTEXT_PHYSICAL_MUTATION_DETECTED';
  end if;
  if v_result.trip_count <> v_result.trips_with_context + v_result.trips_without_context then
    raise exception 'MOBILITY_TRIP_CONTEXT_COVERAGE_FAILED';
  end if;
  if exists (
    select 1 from public.mobility_trip_context_links link
    where link.is_active and ((link.life_event_id is null) = (link.moment_id is null))
  ) then
    raise exception 'MOBILITY_TRIP_CONTEXT_TARGET_XOR_FAILED';
  end if;
end;
$$;

alter table public.mobility_trip_context_links enable row level security;
alter table public.mobility_trip_context_resolutions enable row level security;

revoke all on table public.mobility_trip_context_links from public, anon, authenticated;
revoke all on table public.mobility_trip_context_resolutions from public, anon, authenticated;
grant select, insert, update on table public.mobility_trip_context_links to service_role;
grant select, insert, update on table public.mobility_trip_context_resolutions to service_role;

revoke all on function private.assert_mobility_trip_context_scope() from public, anon, authenticated;
revoke all on function private.assert_mobility_trip_context_resolution_scope() from public, anon, authenticated;
revoke all on function private.rebuild_mobility_trip_contexts_v1() from public, anon, authenticated;
grant execute on function private.assert_mobility_trip_context_scope() to service_role;
grant execute on function private.assert_mobility_trip_context_resolution_scope() to service_role;
grant execute on function private.rebuild_mobility_trip_contexts_v1() to service_role;

commit;
