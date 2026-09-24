begin;

-- Existing PurchaseEvents remain visible to the historical readers. Importers
-- must explicitly select the isolated pilot scope for new purchase-aware data.
alter table public.purchase_events
  add column purchase_visibility text not null default 'DEFAULT',
  add constraint purchase_events_visibility_check check (
    purchase_visibility in ('DEFAULT', 'PURCHASE_AWARE_PILOT')
  );

create index purchase_events_household_visibility_lookup
  on public.purchase_events (household_id, purchase_visibility, purchase_event_id);

commit;
