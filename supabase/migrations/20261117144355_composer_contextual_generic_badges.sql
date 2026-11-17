-- User-owned card preferences, independent from merchant and financial identities.
alter table public.composer_badge_bindings
  add column bundled_asset_key text,
  add column business_label text,
  add constraint composer_badge_binding_generic_selection_check check (
    (bundled_asset_key is null and business_label is null)
    or (bundled_asset_key is not null and business_label is not null
      and bundled_asset_key ~ '^categories:[a-z0-9-]+$'
      and length(btrim(business_label)) between 1 and 120)
  );
alter table public.composer_badge_bindings drop constraint composer_badge_bindings_anchor_key_check;
alter table public.composer_badge_bindings add constraint composer_badge_bindings_anchor_key_check check (
  anchor_key ~ '^(seller|provider|place):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  or anchor_key ~ '^control:[0-9a-f]{64}$'
);
comment on column public.composer_badge_bindings.business_label is
  'Free-entry business name for a generic card badge; never a canonical merchant identity.';
notify pgrst, 'reload schema';
