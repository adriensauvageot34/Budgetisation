begin;

-- P4.8-A1: user-validated payer links for the twelve economically retained
-- Peugeot insurance payments. A payer is not a beneficiary or vehicle owner.
do $$
declare
  v_household_id uuid;
  v_manon uuid;
  v_series_ids uuid[];
  v_inserted integer;
begin
  select p.person_id, p.household_id into strict v_manon, v_household_id
  from public.persons p where p.display_name = 'Manon';

  select array_agg(s.recurrence_series_id order by s.series_key) into v_series_ids
  from public.recurrence_series s
  where s.series_key in (
    'ornikar-assurances-assurances-assurance-automobile',
    'pacifica-assurances-assurance-automobile-contrat-140394759'
  );
  if cardinality(v_series_ids) <> 2 then
    raise exception 'P4.8-A1 expected exactly two principal car-insurance series';
  end if;
  if (select count(*) from public.operations o
      where o.recurrence_series_id = any(v_series_ids) and o.montant < 0) <> 12 then
    raise exception 'P4.8-A1 expected twelve principal insurance payments';
  end if;
  if exists (
    select 1 from public.operations o
    left join public.financial_economic_cost_canonical c on c.operation_id = o.operation_id
    where o.recurrence_series_id = any(v_series_ids) and o.montant < 0
    group by o.operation_id, o.montant
    having count(c.canonical_component_key) <> 1
      or sum(c.canonical_economic_net) <> abs(o.montant)
      or sum(c.refund_applied) <> 0
  ) then
    raise exception 'P4.8-A1 principal insurance payment differs from canonical net';
  end if;
  if exists (
    select 1 from public.financial_source_person_links l
    join public.operations o on o.operation_id = l.operation_id
    where o.recurrence_series_id = any(v_series_ids)
      and l.relation_type = 'payer' and l.person_id <> v_manon
  ) then
    raise exception 'P4.8-A1 conflicting insurance payer';
  end if;

  insert into public.financial_source_person_links (
    financial_source_person_link_id, source_kind, operation_id, person_id,
    relation_type, created_at, created_by, updated_at, validated_at, validated_by
  )
  select gen_random_uuid(), 'Operation', o.operation_id, v_manon,
    'payer', now(), 'USER_VALIDATED:P4.8-A1', now(), now(), 'USER_VALIDATED:P4.8-A1'
  from public.operations o
  where o.recurrence_series_id = any(v_series_ids) and o.montant < 0
    and not exists (
      select 1 from public.financial_source_person_links l
      where l.source_kind = 'Operation' and l.operation_id = o.operation_id
        and l.person_id = v_manon and l.relation_type = 'payer'
    );
  get diagnostics v_inserted = row_count;
  if v_inserted <> 12 then
    raise exception 'P4.8-A1 did not create exactly twelve payer links';
  end if;

  perform public.record_analytics_mutation(
    v_household_id, 'persona_car_insurance_payer', v_manon, null,
    'global_reference', array['analysis_global_personas_expanded', 'analysis_global_persona_detail'], false
  );
end;
$$;

commit;
