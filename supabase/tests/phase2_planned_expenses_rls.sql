-- C9 targeted certification probe. REQUIRES human approval before remote use.
-- No schema migration: synthetic auth identities, households, memberships and
-- prospective roots exist only inside this transaction. ALWAYS ROLLBACK.
-- No real user, real household or historical row is modified.
begin;
set local statement_timeout = '30s';
do $setup$
declare
  user_a uuid := gen_random_uuid(); user_b uuid := gen_random_uuid();
  home_a uuid := gen_random_uuid(); home_b uuid := gen_random_uuid();
  root_b uuid := gen_random_uuid();
  costs jsonb := jsonb_build_array(jsonb_build_object('id',gen_random_uuid(), 'assetKey',null,
    'modulePath',jsonb_build_array('other'), 'label','DD6 synthetic cost', 'quantity','1',
    'unitAmount','25.00', 'baselineKey',null));
begin
  perform set_config('dd6.user_a',user_a::text,true), set_config('dd6.user_b',user_b::text,true),
    set_config('dd6.home_a',home_a::text,true), set_config('dd6.home_b',home_b::text,true),
    set_config('dd6.root_b',root_b::text,true), set_config('dd6.costs',costs::text,true);
  insert into auth.users(id,aud,role) values(user_a,'authenticated','authenticated'),(user_b,'authenticated','authenticated');
  insert into public.households(household_id,name,timezone,created_at)
    values(home_a,'DD6_ROLLBACK_A','Europe/Paris',now()),(home_b,'DD6_ROLLBACK_B','Europe/Paris',now());
  insert into private.household_memberships(user_id,household_id) values(user_a,home_a),(user_b,home_b);
  insert into public.phase2_planned_expenses(planned_expense_id,household_id,target_month,family_key,title,cost_items,created_by,updated_by)
    values(root_b,home_b,'2026-10-01','other','DD6_ROLLBACK_B',costs,user_b,user_b);
  if exists(select 1 from pg_trigger where tgrelid='public.phase2_planned_expenses'::regclass and not tgisinternal) then
    raise exception 'DD6_UNEXPECTED_PROSPECTIVE_TRIGGER';
  end if;
end $setup$;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('dd6.user_a'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('dd6.user_a'),'role','authenticated')::text,true);
do $actor_a$
declare
  user_a uuid := current_setting('dd6.user_a')::uuid; user_b uuid := current_setting('dd6.user_b')::uuid;
  home_a uuid := current_setting('dd6.home_a')::uuid; home_b uuid := current_setting('dd6.home_b')::uuid;
  root_a uuid := gen_random_uuid(); root_b uuid := current_setting('dd6.root_b')::uuid;
  costs jsonb := current_setting('dd6.costs')::jsonb;
  affected integer;
begin
  if auth.uid() <> user_a then raise exception 'DD6_ACTOR_A_INVALID'; end if;
  perform set_config('dd6.root_a',root_a::text,true);
  insert into public.phase2_planned_expenses(planned_expense_id,household_id,target_month,family_key,title,cost_items,created_by,updated_by)
    values(root_a,home_a,'2026-10-01','other','DD6_ROLLBACK_A',costs,user_a,user_a);
  if (select count(*) from public.phase2_planned_expenses where planned_expense_id=root_a) <> 1 then raise exception 'DD6_OWN_READ'; end if;
  if (select count(*) from public.phase2_planned_expenses where planned_expense_id=root_b) <> 0 then raise exception 'DD6_FOREIGN_READ'; end if;

  update public.phase2_planned_expenses set title='DD6 updated',updated_by=user_a where planned_expense_id=root_a;
  get diagnostics affected = row_count; if affected <> 1 then raise exception 'DD6_OWN_UPDATE'; end if;
  update public.phase2_planned_expenses set status='DECLARED_REALIZED',updated_by=user_a where planned_expense_id=root_a;
  get diagnostics affected = row_count; if affected <> 1 then raise exception 'DD6_OWN_DECLARE'; end if;
  update public.phase2_planned_expenses set status='PLANNED',updated_by=user_a where planned_expense_id=root_a;
  get diagnostics affected = row_count; if affected <> 1 then raise exception 'DD6_OWN_RESTORE'; end if;
  update public.phase2_planned_expenses set target_month='2026-11-01',updated_by=user_a where planned_expense_id=root_a;
  get diagnostics affected = row_count; if affected <> 1 then raise exception 'DD6_OWN_REPORT'; end if;

  update public.phase2_planned_expenses set title='DD6 forbidden',updated_by=user_a where planned_expense_id=root_b;
  get diagnostics affected = row_count; if affected <> 0 then raise exception 'DD6_FOREIGN_UPDATE'; end if;
  update public.phase2_planned_expenses set status='DECLARED_REALIZED',updated_by=user_a where planned_expense_id=root_b;
  get diagnostics affected = row_count; if affected <> 0 then raise exception 'DD6_FOREIGN_DECLARE'; end if;
  update public.phase2_planned_expenses set status='PLANNED',updated_by=user_a where planned_expense_id=root_b;
  get diagnostics affected = row_count; if affected <> 0 then raise exception 'DD6_FOREIGN_RESTORE'; end if;
  update public.phase2_planned_expenses set target_month='2026-11-01',updated_by=user_a where planned_expense_id=root_b;
  get diagnostics affected = row_count; if affected <> 0 then raise exception 'DD6_FOREIGN_REPORT'; end if;
  delete from public.phase2_planned_expenses where planned_expense_id=root_b;
  get diagnostics affected = row_count; if affected <> 0 then raise exception 'DD6_FOREIGN_DELETE'; end if;

  begin
    insert into public.phase2_planned_expenses(household_id,target_month,family_key,title,cost_items,created_by,updated_by)
      values(home_b,'2026-10-01','other','DD6 forbidden',costs,user_a,user_a);
    raise exception 'DD6_FOREIGN_INSERT_ACCEPTED';
  exception when insufficient_privilege then null; end;
  begin
    update public.phase2_planned_expenses set household_id=home_b where planned_expense_id=root_a;
    raise exception 'DD6_HOUSEHOLD_TAMPERING_ACCEPTED';
  exception when insufficient_privilege then null; end;
  begin
    update public.phase2_planned_expenses set created_by=user_b where planned_expense_id=root_a;
    raise exception 'DD6_AUTHOR_TAMPERING_ACCEPTED';
  exception when insufficient_privilege then null; end;
  begin
    update public.phase2_planned_expenses set updated_by=user_b where planned_expense_id=root_a;
    raise exception 'DD6_UPDATER_TAMPERING_ACCEPTED';
  exception when insufficient_privilege then null; end;
end $actor_a$;

select set_config('request.jwt.claim.sub',current_setting('dd6.user_b'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('dd6.user_b'),'role','authenticated')::text,true);
do $actor_b$
declare affected integer; root_a uuid := current_setting('dd6.root_a')::uuid; root_b uuid := current_setting('dd6.root_b')::uuid;
begin
  if (select count(*) from public.phase2_planned_expenses where planned_expense_id=root_b) <> 1 then raise exception 'DD6_ACTOR_B_OWN_READ'; end if;
  if (select count(*) from public.phase2_planned_expenses where planned_expense_id=root_a) <> 0 then raise exception 'DD6_ACTOR_B_FOREIGN_READ'; end if;
  update public.phase2_planned_expenses set title='DD6 forbidden B',updated_by=auth.uid() where planned_expense_id=root_a;
  get diagnostics affected = row_count; if affected <> 0 then raise exception 'DD6_ACTOR_B_FOREIGN_UPDATE'; end if;
  delete from public.phase2_planned_expenses where planned_expense_id=root_a;
  get diagnostics affected = row_count; if affected <> 0 then raise exception 'DD6_ACTOR_B_FOREIGN_DELETE'; end if;
  delete from public.phase2_planned_expenses where planned_expense_id=root_b;
  get diagnostics affected = row_count; if affected <> 1 then raise exception 'DD6_OWN_DELETE'; end if;
end $actor_b$;

reset role;
do $zero_write$
declare relation_name text; affected bigint;
begin
  -- Targeted traces, not just global counters: neither fixture household/root may
  -- occur in any protected authority. No personal row payload is returned.
  foreach relation_name in array array['operations','life_events','moments','mobility_legs','mobility_trips',
    'persons','referentiel_lieu','person_place_roles','fuel_price_observations',
    'benefit_wallets','benefit_wallet_ledger_entries','analytics_query_snapshots','analytics_artifacts','analytics_publications'] loop
    if exists(select 1 from information_schema.columns where table_schema='public'
      and table_name=relation_name and column_name='household_id') then
      execute format('select count(*) from public.%I where household_id in ($1,$2)',relation_name)
        into affected using current_setting('dd6.home_a')::uuid,current_setting('dd6.home_b')::uuid;
    else
      execute format('select count(*) from public.%I t where to_jsonb(t)::text like $1 or to_jsonb(t)::text like $2 or to_jsonb(t)::text like $3 or to_jsonb(t)::text like $4',relation_name)
        into affected using '%'||current_setting('dd6.home_a')||'%', '%'||current_setting('dd6.home_b')||'%',
          '%'||current_setting('dd6.root_a')||'%', '%'||current_setting('dd6.root_b')||'%';
    end if;
    if affected <> 0 then raise exception 'DD6_HISTORICAL_TRACE_%',relation_name; end if;
  end loop;
end $zero_write$;
rollback;
select 'PASS' as rls_two_households, 'PASS' as targeted_historical_traces, 'ROLLBACK' as persistence;
