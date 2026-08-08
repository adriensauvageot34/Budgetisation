begin;

grant update, delete on public.operations to authenticated;

drop policy if exists "Members can update operations" on public.operations;
create policy "Members can update operations"
  on public.operations for update to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));

drop policy if exists "Members can delete operations" on public.operations;
create policy "Members can delete operations"
  on public.operations for delete to authenticated
  using (private.is_household_member(household_id));

create or replace function private.sync_import_batch_row_count_after_operation_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.import_batch_id is not null then
    update public.import_batches batch
    set row_count = (
      select count(*)::integer
      from public.operations operation
      where operation.import_batch_id = old.import_batch_id
    )
    where batch.id = old.import_batch_id;
  end if;

  return old;
end;
$$;

revoke all on function private.sync_import_batch_row_count_after_operation_delete()
  from public, anon, authenticated;

drop trigger if exists sync_import_batch_row_count_after_operation_delete
  on public.operations;
create trigger sync_import_batch_row_count_after_operation_delete
after delete on public.operations
for each row
execute function private.sync_import_batch_row_count_after_operation_delete();

commit;
