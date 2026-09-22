begin;

-- P4.8-A: contextual links only. None of these rows establishes a payer,
-- beneficiary, personal cost, or inferred transaction frequency.
do $$
declare
  v_household_id uuid;
  v_adrien uuid;
  v_manon uuid;
  v_place uuid;
  v_tag uuid;
  v_suno_series uuid;
  v_permit_series uuid;
  v_link record;
begin
  select p.person_id, p.household_id into strict v_adrien, v_household_id
    from public.persons p where p.display_name = 'Adrien';
  select p.person_id into strict v_manon
    from public.persons p where p.display_name = 'Manon' and p.household_id = v_household_id;

  for v_link in
    select v_manon as person_id, 'chez_le_pere_de_manon_fontes'::text as place_key, 'FATHER_HOME'::text as role
    union all select v_manon, 'famille_de_manon_servian', 'MATERNAL_FAMILY_HOME'
    union all select v_manon, 'promotrans_montpellier', 'PRIMARY_WORK'
    union all select v_manon, 'marie_blachere_montpellier_sud', 'WORK_MEAL_ANCHOR'
    union all select v_adrien, 'boulangerie_ange', 'WORK_MEAL_ANCHOR'
    union all select v_adrien, 'dali_barber', 'PERSONAL_CARE_ANCHOR'
    union all select v_adrien, 'dbha_coiff_saint_gely_du_fesc', 'PERSONAL_CARE_ANCHOR'
    union all select v_manon, 'chez_amandine', 'SOCIAL_ANCHOR'
  loop
    select p.place_id into strict v_place from public.referentiel_lieu p where p.place_key = v_link.place_key;
    insert into public.person_place_roles (person_place_role_id, person_id, place_id, role, source, created_at, updated_at)
    select gen_random_uuid(), v_link.person_id, v_place, v_link.role, 'USER_VALIDATED:P4.8-A', now(), now()
    where not exists (
      select 1 from public.person_place_roles r
      where r.person_id = v_link.person_id and r.place_id = v_place and r.role = v_link.role
    );
  end loop;

  insert into public.tags (tag_id, tag_key, libelle, type_tag)
  values
    (gen_random_uuid(), 'Contexte:univers_musique_adrien', 'Univers musique Adrien', 'Contexte'),
    (gen_random_uuid(), 'Contexte:projet_suno_manon', 'Chanson pour le père de Manon', 'Contexte')
  on conflict (tag_key) do nothing;

  select t.tag_id into strict v_tag from public.tags t where t.tag_key = 'Contexte:univers_musique_adrien';
  insert into public.operation_tags (operation_tag_id, operation_id, tag_id, source_legacy_field)
  select gen_random_uuid(), o.operation_id, v_tag, 'USER_VALIDATED:P4.8-A'
  from public.operations o
  where o.date_transaction_reelle = '2026-01-09'
    and o.marchand = 'Amazon'
    and o.montant = -222
    and o.description_precise = 'Casque Beyerdynamic DT 900 Pro X'
    and not exists (select 1 from public.operation_tags ot where ot.operation_id = o.operation_id and ot.tag_id = v_tag);
  if (select count(*) from public.operation_tags ot where ot.tag_id = v_tag) <> 1 then
    raise exception 'P4.8-A headphone relation must resolve exactly one purchase';
  end if;

  select s.recurrence_series_id into strict v_suno_series
    from public.recurrence_series s where s.series_key = 'suno-direct-abonnement-2026-carte-x3879';
  select t.tag_id into strict v_tag from public.tags t where t.tag_key = 'Contexte:projet_suno_manon';
  insert into public.operation_tags (operation_tag_id, operation_id, tag_id, source_legacy_field)
  select gen_random_uuid(), o.operation_id, v_tag, 'USER_VALIDATED:P4.8-A'
  from public.operations o
  where o.date_transaction_reelle in ('2026-03-15', '2026-04-15')
    and o.recurrence_series_id = v_suno_series
    and o.marchand = 'Suno'
    and o.montant = -10.8
    and not exists (select 1 from public.operation_tags ot where ot.operation_id = o.operation_id and ot.tag_id = v_tag);

  if (select count(*) from public.operation_tags ot join public.tags t on t.tag_id = ot.tag_id
      where t.tag_key = 'Contexte:projet_suno_manon') <> 2 then
    raise exception 'P4.8-A Suno relation must include exactly March and April';
  end if;

  -- The four financing payments fund the driving-lessons project; the
  -- similarly named Ornikar insurance series is intentionally excluded.
  select s.recurrence_series_id into strict v_permit_series
    from public.recurrence_series s where s.series_key = 'ornikar-alma-permis-de-conduire-lecons-forfait-ornikar';
  select t.tag_id into strict v_tag from public.tags t where t.tag_key = 'Contexte:permis_de_conduire';
  insert into public.operation_tags (operation_tag_id, operation_id, tag_id, source_legacy_field)
  select gen_random_uuid(), o.operation_id, v_tag, 'USER_VALIDATED:P4.8-A'
  from public.operations o
  where o.recurrence_series_id = v_permit_series
    and o.date_transaction_reelle between '2026-05-01' and '2026-07-31'
    and o.marchand = 'Ornikar / Alma'
    and not exists (select 1 from public.operation_tags ot where ot.operation_id = o.operation_id and ot.tag_id = v_tag);

  if (select count(*) from public.operation_tags ot join public.operations o on o.operation_id = ot.operation_id
      where ot.tag_id = v_tag and o.recurrence_series_id = v_permit_series) <> 4 then
    raise exception 'P4.8-A permit financing relation must include four payments';
  end if;

  -- Canonical data changed. Invalidate the previous Global V2 generation once,
  -- after all links have been written, before the single controlled replay.
  perform public.record_analytics_mutation(
    v_household_id, 'persona_editorial_relations', v_manon, null,
    'global_reference', array['analysis_global_personas_expanded', 'analysis_global_persona_detail'], false
  );
end;
$$;

commit;
