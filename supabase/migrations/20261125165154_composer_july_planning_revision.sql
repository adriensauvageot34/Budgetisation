begin;

-- Revision of the locally saved choices and the published Plan pointer, with
-- exactly the access used by the regular draft and Plan readers.
create function public.composer_july_saved_revision_v1(p_household uuid)
returns text
language sql stable security invoker
set search_path = ''
as $$
  select encode(sha256(convert_to(jsonb_build_array(
    (select jsonb_build_array(d.draft_id, d.draft_version, d.semantic_state_digest)
     from public.phase2_composer_drafts d
     where d.household_id = p_household and d.owner_user_id = (select auth.uid())
       and d.target_month = date '2026-07-01' and d.lifecycle = 'ACTIVE'),
    (select jsonb_build_array(p.plan_id, p.active_revision_id, p.active_revision_number)
     from public.phase2_month_plans p
     where p.household_id = p_household and p.target_month = date '2026-07-01')
  )::text, 'UTF8')), 'hex')
  where (select auth.uid()) is not null;
$$;

-- Supplemental forecast and trip inputs outside the transactional basis proof.
create function public.composer_july_planning_revision_v1(p_household uuid)
returns text
language sql stable security invoker
set search_path = ''
as $$
  select encode(sha256(convert_to(jsonb_build_array(
    b.revision,
    (select jsonb_agg(to_jsonb(n) order by n.need_id) from public.needs n),
    (select jsonb_agg(to_jsonb(i) order by i.import_batch_id) from public.import_batches i where i.household_id = p_household),
    (select jsonb_agg(to_jsonb(w) order by w.benefit_wallet_id) from public.benefit_wallets w where w.household_id = p_household),
    (select jsonb_agg(to_jsonb(d) order by d.dataset_id) from public.mobility_datasets d where d.household_id = p_household),
    (select jsonb_agg(to_jsonb(m) order by m.target_month) from public.phase2_month_inputs m where m.household_id = p_household),
    (select jsonb_agg(to_jsonb(f) order by f.purchase_funding_component_id) from public.purchase_funding_components f where f.household_id = p_household),
    (select jsonb_agg(to_jsonb(l) order by l.benefit_wallet_ledger_entry_id) from public.benefit_wallet_ledger_entries l
     where l.household_id = p_household and l.event_date <= date '2026-07-15'),
    (select jsonb_agg(to_jsonb(v) order by v.vehicle_id) from public.vehicles v where v.household_id = p_household),
    (select jsonb_agg(to_jsonb(f) order by f.fuel_price_observation_id) from public.fuel_price_observations f),
    (select jsonb_agg(to_jsonb(r) order by r.person_place_role_id) from public.person_place_roles r
     join public.persons p on p.person_id = r.person_id where p.household_id = p_household)
  )::text, 'UTF8')), 'hex')
  from public.composer_july_projection_revision_v1(p_household) b(revision)
  where b.revision is not null;
$$;

revoke all on function public.composer_july_saved_revision_v1(uuid) from public, anon, authenticated, service_role;
grant execute on function public.composer_july_saved_revision_v1(uuid) to authenticated;
revoke all on function public.composer_july_planning_revision_v1(uuid) from public, anon, authenticated, service_role;
grant execute on function public.composer_july_planning_revision_v1(uuid) to service_role;

notify pgrst, 'reload schema';
commit;
