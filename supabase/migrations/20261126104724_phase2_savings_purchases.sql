begin;

create table public.phase2_savings_purchases (
  household_id uuid not null references public.households(household_id),
  operation_id uuid not null references public.operations(operation_id) on delete cascade,
  goal_id uuid not null references public.phase2_savings_goals(goal_id),
  payment_date date not null,
  payment_label text not null check (char_length(payment_label) between 1 and 160),
  cents integer not null check (cents between 1 and 99999999),
  primary key (operation_id, goal_id)
);

create index phase2_savings_purchases_household_date
  on public.phase2_savings_purchases (household_id, payment_date);
create index phase2_savings_purchases_goal on public.phase2_savings_purchases (goal_id);

alter table public.phase2_savings_purchases enable row level security;
revoke all on public.phase2_savings_purchases from public, anon, authenticated, service_role;
grant select on public.phase2_savings_purchases to authenticated;
grant select, insert, update, delete on public.phase2_savings_purchases to service_role;
create policy savings_purchases_read on public.phase2_savings_purchases
  for select to authenticated using ((select private.user_has_household_access(household_id)));

create function public.set_phase2_savings_purchase(
  p_household uuid, p_operation uuid, p_goal uuid, p_cents integer, p_previous integer
) returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  payment_cents bigint;
  bank_date date;
  bank_label text;
  current_cents integer;
  otherwise_assigned bigint;
begin
  if p_cents is null or p_cents not between 0 and 99999999
    or p_previous is null or p_previous not between 0 and 99999999 then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;

  -- Serialize allocations for the same payment without modifying canon.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_operation::text, 2826));
  select round(-o.montant * 100)::bigint, o.date_bancaire,
    left(coalesce(nullif(btrim(o.marchand), ''), nullif(btrim(o.libelle_bancaire), ''), 'Achat'), 160)
  into payment_cents, bank_date, bank_label
  from public.operations o
  left join public.import_batches b on b.import_batch_id = o.import_batch_id
  where o.operation_id = p_operation and o.flux = 'Dépense' and o.montant < 0
    and (b.household_id = p_household or (o.import_batch_id is null and exists (
      select 1 from public.canonical_household_scope_control s
      where s.status = 'READY' and s.household_id = p_household
    )));

  if bank_date is null or not exists (
    select 1 from public.phase2_savings_goals g where g.goal_id = p_goal and g.household_id = p_household
  ) then
    raise exception 'PURCHASE_UNAVAILABLE' using errcode = '22023';
  end if;

  select coalesce(sum(cents) filter (where goal_id <> p_goal), 0),
    coalesce(max(cents) filter (where goal_id = p_goal), 0)
  into otherwise_assigned, current_cents
  from public.phase2_savings_purchases
  where operation_id = p_operation and household_id = p_household;

  if current_cents = p_cents then return; end if;
  if current_cents <> p_previous then
    raise exception 'PURCHASE_CHANGED' using errcode = '40001';
  end if;
  if p_cents = 0 then
    delete from public.phase2_savings_purchases
      where operation_id = p_operation and goal_id = p_goal and household_id = p_household;
    return;
  end if;
  if otherwise_assigned + p_cents > payment_cents then
    raise exception 'PAYMENT_EXCEEDED' using errcode = '23514';
  end if;

  insert into public.phase2_savings_purchases (household_id, operation_id, goal_id, payment_date, payment_label, cents)
  values (p_household, p_operation, p_goal, bank_date, bank_label, p_cents)
  on conflict (operation_id, goal_id) do update set
    cents = excluded.cents, payment_date = excluded.payment_date, payment_label = excluded.payment_label;
end;
$$;

revoke all on function public.set_phase2_savings_purchase(uuid, uuid, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.set_phase2_savings_purchase(uuid, uuid, uuid, integer, integer) to service_role;
notify pgrst, 'reload schema';
commit;
