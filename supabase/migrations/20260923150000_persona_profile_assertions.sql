begin;

-- These are explicitly declared profile facts, not inferred bank payments.
create table public.persona_profile_assertions (
  assertion_id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(household_id),
  person_id uuid not null references public.persons(person_id),
  assertion_key text not null check (assertion_key in (
    'daily_cigarettes', 'approximate_household_tobacco_budget', 'vehicle_maintenance_responsibility'
  )),
  numeric_value numeric(10,2),
  authority text not null check (authority = 'USER_VALIDATED'),
  validated_at timestamptz not null default now(),
  source_note text not null,
  unique (person_id, assertion_key),
  check ((assertion_key = 'daily_cigarettes' and numeric_value > 0)
    or (assertion_key <> 'daily_cigarettes' and numeric_value is null))
);

create index persona_profile_assertions_household_idx
  on public.persona_profile_assertions (household_id, person_id);

alter table public.persona_profile_assertions enable row level security;
revoke all on table public.persona_profile_assertions from public, anon, authenticated;
grant select on table public.persona_profile_assertions to service_role;

do $$
declare
  v_adrien uuid;
  v_manon uuid;
  v_household uuid;
begin
  select person_id, household_id into strict v_adrien, v_household
    from public.persons where display_name = 'Adrien';
  select person_id into strict v_manon
    from public.persons where display_name = 'Manon' and household_id = v_household;

  insert into public.persona_profile_assertions
    (household_id, person_id, assertion_key, numeric_value, authority, source_note)
  values
    (v_household, v_manon, 'daily_cigarettes', 2, 'USER_VALIDATED',
     'P4.8-F user declaration: approximately two cigarettes per day; no personal tobacco payment inferred'),
    (v_household, v_adrien, 'approximate_household_tobacco_budget', null, 'USER_VALIDATED',
     'P4.8-F user declaration: show the existing household tobacco budget as an approximate Adrien estimate, not personal payment'),
    (v_household, v_manon, 'vehicle_maintenance_responsibility', null, 'USER_VALIDATED',
     'P4.8-F user declaration: Manon handles Peugeot maintenance; vehicle remains household-owned');

  perform public.record_analytics_mutation(
    v_household, 'persona_profile_assertions', v_adrien, null,
    'global_reference', array['analysis_global_personas_expanded', 'analysis_global_persona_detail'], false
  );
end;
$$;

commit;
