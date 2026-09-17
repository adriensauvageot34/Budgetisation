begin;

create table public.timeline_event_semantic_assertions (
  timeline_event_semantic_assertion_id uuid primary key,
  household_id uuid not null references public.households (household_id),
  moment_id uuid references public.moments (moment_id) on delete cascade,
  life_event_id uuid references public.life_events (life_event_id) on delete cascade,
  visibility_tier text not null check (visibility_tier in ('PRINCIPAL', 'EXTENDED')),
  close_family_key text not null check (close_family_key in (
    'achat_installation_d_un_equipement_important',
    'activite_de_loisir_a_preciser',
    'activite_nautique',
    'amenagement_interieur',
    'anniversaire',
    'audition_convocation',
    'bowling',
    'club_boite_de_nuit',
    'coiffeur_barbier',
    'concert_spectacle_musical',
    'consultation_medicale',
    'controle_technique',
    'celebration_de_couple',
    'deplacement_professionnel_avec_nuitee',
    'diner_social_restaurant',
    'entretien_courant_vehicule',
    'examen_du_code',
    'fast_food_comme_sortie',
    'feria_fete_populaire',
    'fete_annuelle_familiale',
    'glace_dessert_gouter',
    'intervention_rendez_vous_professionnel_exterieur',
    'jeux_activite_ludique',
    'journee_plage_baignade',
    'loisir_sportif',
    'obseques_funerailles',
    'parcours_permis_de_conduire',
    'piercing_modification_corporelle',
    'projet_seance_photo',
    'recherche_de_mobilier_pour_un_projet',
    'reparation',
    'reunion_familiale_festive',
    'reveillon_nouvel_an',
    'salon_evenement_professionnel',
    'session_shopping_vetements',
    'soin_consultation_dentaire',
    'soiree_bars_tournee_de_bars',
    'soiree_techno_rave',
    'sortie_cafe_verre',
    'sortie_nature_site_remarquable',
    'sortie_nocturne_en_etablissement',
    'sortie_restaurant',
    'spectacle_representation_culturelle',
    'sejour_chez_des_amis',
    'sejour_chez_la_famille',
    'sejour_ski',
    'sejour_vacances_en_france',
    'visite_ami',
    'visite_de_site_decouverte',
    'visite_famille',
    'visite_a_un_proche_hospitalise',
    'voyage_vacances_a_l_etranger',
    'week_end_escapade_regionale'
  )),
  taxonomy_version text not null check (taxonomy_version = 'timeline_semantic_taxonomy@v1'),
  authority text not null check (btrim(authority) <> ''),
  provenance text not null check (btrim(provenance) <> ''),
  evidence_refs jsonb not null,
  source_revision bigint not null check (source_revision > 0),
  declared_at timestamptz not null,
  validated_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint timeline_event_semantic_identity_xor
    check (num_nonnulls(moment_id, life_event_id) = 1),
  constraint timeline_event_semantic_evidence_array
    check (jsonb_typeof(evidence_refs) = 'array' and jsonb_array_length(evidence_refs) > 0),
  constraint timeline_event_semantic_active_validation
    check (not is_active or validated_at is not null),
  constraint timeline_event_semantic_validation_order
    check (validated_at is null or validated_at >= declared_at)
);

create unique index timeline_event_semantic_one_active_moment
  on public.timeline_event_semantic_assertions (household_id, moment_id)
  where is_active and moment_id is not null;

create unique index timeline_event_semantic_one_active_life_event
  on public.timeline_event_semantic_assertions (household_id, life_event_id)
  where is_active and life_event_id is not null;

create index timeline_event_semantic_active_lookup
  on public.timeline_event_semantic_assertions
  (household_id, is_active, taxonomy_version, close_family_key);

create function private.assert_timeline_semantic_entity_household_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_entity_household_id uuid;
  v_participant_household_count bigint;
  v_matching_household_count bigint;
begin
  if new.moment_id is not null then
    select m.household_id
      into v_entity_household_id
    from public.moments m
    where m.moment_id = new.moment_id;

    if not found or v_entity_household_id is distinct from new.household_id then
      raise exception using
        errcode = '23514',
        message = 'Timeline semantic Moment is outside the assertion Household.';
    end if;
  else
    if not exists (
      select 1 from public.life_events le where le.life_event_id = new.life_event_id
    ) then
      raise exception using
        errcode = '23503',
        message = 'Timeline semantic LifeEvent does not exist.';
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
        message = 'Timeline semantic LifeEvent is outside the assertion Household.';
    end if;
  end if;
  return new;
end;
$$;

create trigger timeline_event_semantic_household_scope_guard
before insert or update of household_id
on public.timeline_event_semantic_assertions
for each row execute function private.assert_history_v2_household_scope();

create trigger timeline_event_semantic_entity_household_scope_guard
before insert or update of household_id, moment_id, life_event_id
on public.timeline_event_semantic_assertions
for each row execute function private.assert_timeline_semantic_entity_household_scope();

create function public.activate_timeline_event_semantic_assertion(
  p_assertion_id uuid,
  p_household_id uuid,
  p_moment_id uuid,
  p_life_event_id uuid,
  p_visibility_tier text,
  p_close_family_key text,
  p_taxonomy_version text,
  p_authority text,
  p_provenance text,
  p_evidence_refs jsonb,
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
    pg_catalog.hashtextextended(
      p_household_id::text || ':' || coalesce(p_moment_id::text, p_life_event_id::text),
      0
    )
  );

  update public.timeline_event_semantic_assertions
  set is_active = false,
      updated_at = pg_catalog.now()
  where household_id = p_household_id
    and is_active
    and (
      (p_moment_id is not null and moment_id = p_moment_id)
      or (p_life_event_id is not null and life_event_id = p_life_event_id)
    );

  insert into public.timeline_event_semantic_assertions (
    timeline_event_semantic_assertion_id,
    household_id,
    moment_id,
    life_event_id,
    visibility_tier,
    close_family_key,
    taxonomy_version,
    authority,
    provenance,
    evidence_refs,
    source_revision,
    declared_at,
    validated_at,
    is_active
  ) values (
    p_assertion_id,
    p_household_id,
    p_moment_id,
    p_life_event_id,
    p_visibility_tier,
    p_close_family_key,
    p_taxonomy_version,
    p_authority,
    p_provenance,
    p_evidence_refs,
    p_source_revision,
    p_declared_at,
    p_validated_at,
    true
  );

  return p_assertion_id;
end;
$$;

alter table public.timeline_event_semantic_assertions enable row level security;

revoke all on table public.timeline_event_semantic_assertions from public, anon, authenticated;
grant select, insert, update on table public.timeline_event_semantic_assertions to service_role;

revoke all on function private.assert_timeline_semantic_entity_household_scope() from public, anon, authenticated;
grant execute on function private.assert_timeline_semantic_entity_household_scope() to service_role;
revoke all on function public.activate_timeline_event_semantic_assertion(
  uuid, uuid, uuid, uuid, text, text, text, text, text, jsonb, bigint, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.activate_timeline_event_semantic_assertion(
  uuid, uuid, uuid, uuid, text, text, text, text, text, jsonb, bigint, timestamptz, timestamptz
) to service_role;

commit;
