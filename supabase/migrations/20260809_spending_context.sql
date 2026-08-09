begin;

alter table public.operations
  add column if not exists spending_context text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.operations'::regclass
      and conname = 'operations_spending_context_check'
  ) then
    alter table public.operations
      add constraint operations_spending_context_check
      check (
        spending_context is null
        or spending_context in ('Vie courante', 'Événement')
      );
  end if;
end;
$$;

commit;
