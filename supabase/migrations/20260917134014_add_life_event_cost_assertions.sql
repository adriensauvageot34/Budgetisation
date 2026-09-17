begin;

create function private.is_timeline_cost_component_key_list(p_keys jsonb)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select
    pg_catalog.jsonb_typeof(p_keys) = 'array'
    and not exists (
      select 1
      from pg_catalog.jsonb_array_elements(p_keys) as entry(value)
      where pg_catalog.jsonb_typeof(entry.value) <> 'string'
         or (entry.value #>> '{}') !~ '^(operation|allocation|item|cash_use):[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    )
    and pg_catalog.jsonb_array_length(p_keys) = (
      select count(distinct entry.value #>> '{}')
      from pg_catalog.jsonb_array_elements(p_keys) as entry(value)
    )
    and p_keys = coalesce((
      select pg_catalog.jsonb_agg(entry.value #>> '{}' order by entry.value #>> '{}')
      from pg_catalog.jsonb_array_elements(p_keys) as entry(value)
    ), '[]'::jsonb);
$$;

create table public.life_event_cost_assertions (
  life_event_cost_assertion_id uuid primary key,
  household_id uuid not null references public.households (household_id),
  life_event_id uuid not null references public.life_events (life_event_id) on delete cascade,
  closure_status text not null check (closure_status in ('COMPLETE', 'EXPLICIT_EMPTY')),
  expected_component_keys jsonb not null,
  method_version text not null check (method_version = 'timeline-event-cost@v1'),
  authority text not null check (btrim(authority) <> ''),
  evidence_refs jsonb not null,
  provenance text not null check (btrim(provenance) <> ''),
  source_revision bigint not null check (source_revision > 0),
  declared_at timestamptz not null,
  validated_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint life_event_cost_expected_keys_canonical
    check (private.is_timeline_cost_component_key_list(expected_component_keys)),
  constraint life_event_cost_closure_shape check (
    (closure_status = 'COMPLETE' and jsonb_array_length(expected_component_keys) > 0)
    or (closure_status = 'EXPLICIT_EMPTY' and jsonb_array_length(expected_component_keys) = 0)
  ),
  constraint life_event_cost_evidence_array
    check (jsonb_typeof(evidence_refs) = 'array' and jsonb_array_length(evidence_refs) > 0),
  constraint life_event_cost_active_validation
    check (not is_active or validated_at is not null),
  constraint life_event_cost_validation_order
    check (validated_at is null or validated_at >= declared_at)
);

create unique index life_event_cost_one_active_assertion
  on public.life_event_cost_assertions (household_id, life_event_id)
  where is_active;

create index life_event_cost_life_event_fk_lookup
  on public.life_event_cost_assertions (life_event_id);

create index life_event_cost_active_lookup
  on public.life_event_cost_assertions (household_id, is_active, source_revision desc);

create function private.assert_life_event_cost_household_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_participant_household_count bigint;
  v_matching_household_count bigint;
begin
  if not exists (
    select 1 from public.life_events le where le.life_event_id = new.life_event_id
  ) then
    raise exception using
      errcode = '23503',
      message = 'LifeEvent cost assertion target does not exist.';
  end if;

  select count(distinct p.household_id),
         count(distinct p.household_id) filter (where p.household_id = new.household_id)
    into v_participant_household_count, v_matching_household_count
  from public.life_event_participations lep
  join public.persons p on p.person_id = lep.person_id
  where lep.life_event_id = new.life_event_id;

  if v_participant_household_count > 0
     and (v_participant_household_count <> 1 or v_matching_household_count <> 1)
  then
    raise exception using
      errcode = '23514',
      message = 'LifeEvent cost assertion is outside the assertion Household.';
  end if;
  return new;
end;
$$;

create trigger life_event_cost_household_scope_guard
before insert or update of household_id
on public.life_event_cost_assertions
for each row execute function private.assert_history_v2_household_scope();

create trigger life_event_cost_entity_household_scope_guard
before insert or update of household_id, life_event_id
on public.life_event_cost_assertions
for each row execute function private.assert_life_event_cost_household_scope();

create function public.activate_life_event_cost_assertion(
  p_assertion_id uuid,
  p_household_id uuid,
  p_life_event_id uuid,
  p_closure_status text,
  p_expected_component_keys jsonb,
  p_method_version text,
  p_authority text,
  p_evidence_refs jsonb,
  p_provenance text,
  p_source_revision bigint,
  p_declared_at timestamptz,
  p_validated_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_household_id::text || ':' || p_life_event_id::text, 0)
  );

  update public.life_event_cost_assertions
  set is_active = false,
      updated_at = pg_catalog.now()
  where household_id = p_household_id
    and life_event_id = p_life_event_id
    and is_active;

  insert into public.life_event_cost_assertions (
    life_event_cost_assertion_id,
    household_id,
    life_event_id,
    closure_status,
    expected_component_keys,
    method_version,
    authority,
    evidence_refs,
    provenance,
    source_revision,
    declared_at,
    validated_at,
    is_active
  ) values (
    p_assertion_id,
    p_household_id,
    p_life_event_id,
    p_closure_status,
    p_expected_component_keys,
    p_method_version,
    p_authority,
    p_evidence_refs,
    p_provenance,
    p_source_revision,
    p_declared_at,
    p_validated_at,
    true
  );

  return p_assertion_id;
end;
$$;

alter table public.life_event_cost_assertions enable row level security;

revoke all on table public.life_event_cost_assertions from public, anon, authenticated;
grant select, insert, update on table public.life_event_cost_assertions to service_role;

revoke all on function private.is_timeline_cost_component_key_list(jsonb) from public, anon, authenticated;
grant execute on function private.is_timeline_cost_component_key_list(jsonb) to service_role;
revoke all on function private.assert_life_event_cost_household_scope() from public, anon, authenticated;
grant execute on function private.assert_life_event_cost_household_scope() to service_role;
revoke all on function public.activate_life_event_cost_assertion(
  uuid, uuid, uuid, text, jsonb, text, text, jsonb, text, bigint, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.activate_life_event_cost_assertion(
  uuid, uuid, uuid, text, jsonb, text, text, jsonb, text, bigint, timestamptz, timestamptz
) to service_role;

commit;
