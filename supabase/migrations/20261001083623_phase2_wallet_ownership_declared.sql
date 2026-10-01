-- Explicit user attribution: Swile = Adrien, Edenred = Manon.
-- No ledger entry, balance, operation, import or financial amount is created.
begin;
do $$
declare
  target_household uuid;
  adrien_id uuid;
  manon_id uuid;
begin
  select h.household_id into strict target_household from public.households h
    where exists (select 1 from public.persons p where p.household_id=h.household_id and p.display_name='Adrien' and p.status='active')
      and exists (select 1 from public.persons p where p.household_id=h.household_id and p.display_name='Manon' and p.status='active')
      and exists (select 1 from public.benefit_wallets w where w.household_id=h.household_id and w.provider='SWILE');
  select person_id into strict adrien_id from public.persons where household_id=target_household and display_name='Adrien' and status='active';
  select person_id into strict manon_id from public.persons where household_id=target_household and display_name='Manon' and status='active';
  if exists (select 1 from public.benefit_wallets where household_id=target_household
    and ((provider='SWILE' and owner_person_id is not null and owner_person_id<>adrien_id)
      or (provider='EDENRED' and owner_person_id is not null and owner_person_id<>manon_id))) then
    raise exception 'Existing wallet ownership conflicts with user declaration';
  end if;
  update public.benefit_wallets set owner_person_id=adrien_id, updated_at=now()
    where household_id=target_household and provider='SWILE' and owner_person_id is null;
  update public.benefit_wallets set owner_person_id=manon_id, updated_at=now()
    where household_id=target_household and provider='EDENRED' and owner_person_id is null;
  if not exists (select 1 from public.benefit_wallets where household_id=target_household and provider='EDENRED') then
    insert into public.benefit_wallets (benefit_wallet_id,household_id,provider,source_instance_key,wallet_type,currency,owner_person_id,status,provenance)
      values (gen_random_uuid(),target_household,'EDENRED','user-declared-edenred-manon','MEAL_VOUCHER_ACCOUNT','EUR',manon_id,'ACTIVE','EXPLICIT_USER_ASSERTION');
  end if;
end;
$$;
commit;
