begin;

-- A declared routine and indicative visit price, not an observed purchase,
-- payment attribution, or bank cost. Only trusted server reads use this table.
create table public.person_habit_assertions (
  person_habit_assertion_id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(household_id),
  person_id uuid not null references public.persons(person_id),
  habit_key text not null check (habit_key = 'hairdresser'),
  monthly_visit_estimate numeric(4,2) not null check (monthly_visit_estimate > 0),
  typical_visit_price numeric(10,2) not null check (typical_visit_price >= 0),
  price_basis text not null check (price_basis = 'INDICATIVE_PRICE_NOT_PAYMENT'),
  authority text not null check (authority = 'USER_VALIDATED'),
  validated_at timestamptz not null default now(),
  source_note text not null,
  unique (person_id, habit_key)
);

create index person_habit_assertions_household_idx
  on public.person_habit_assertions (household_id, person_id);

alter table public.person_habit_assertions enable row level security;
revoke all on table public.person_habit_assertions from public, anon, authenticated;
grant select on table public.person_habit_assertions to service_role;

do $$
declare
  v_person_id uuid;
  v_household_id uuid;
begin
  select p.person_id, p.household_id into strict v_person_id, v_household_id
    from public.persons p where p.display_name = 'Adrien';

  insert into public.person_habit_assertions (
    household_id, person_id, habit_key, monthly_visit_estimate,
    typical_visit_price, price_basis, authority, source_note
  ) values (
    v_household_id, v_person_id, 'hairdresser', 1, 20,
    'INDICATIVE_PRICE_NOT_PAYMENT', 'USER_VALIDATED',
    'USER_VALIDATED:Persona editorial review 2026-09-23; approximately monthly for years and approximately EUR 20 per visit'
  );

  perform public.record_analytics_mutation(
    v_household_id, 'persona_hairdresser_assertion', v_person_id, null,
    'global_reference', array['analysis_global_personas_expanded', 'analysis_global_persona_detail'], false
  );
end;
$$;

commit;
