alter table public.merchants
  add column commercial_display_name text,
  add column commercial_family_key text,
  add column generic_badge_category text,
  add constraint merchants_commercial_display_name_check check (
    commercial_display_name = btrim(commercial_display_name)
    and length(commercial_display_name) between 1 and 120
  ),
  add constraint merchants_commercial_family_key_check check (
    commercial_family_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  add constraint merchants_generic_badge_category_check check (
    generic_badge_category in ('BAKERY', 'BAR', 'HAIRDRESSER')
  ),
  add constraint merchants_commercial_presentation_kind_check check (
    identity_kind = 'commercial' or (
      commercial_display_name is null and commercial_family_key is null and generic_badge_category is null
    )
  );

comment on column public.merchants.commercial_display_name is
  'Recognized trade name for display. Does not replace the merchant key, canonical name, or raw transaction label.';
comment on column public.merchants.commercial_family_key is
  'Commercial family. Does not identify a merchant, a place, or a shared badge.';
comment on column public.merchants.generic_badge_category is
  'Category visual used when no merchant-specific or shared visual is available.';

alter table public.composer_badge_visuals
  drop constraint composer_badge_visuals_category_check,
  add constraint composer_badge_visuals_category_check check (
    category in ('GROCERIES','BAKERY','RESTAURANT','BAR','HAIRDRESSER','BEAUTY','CLOTHING','HOME','ACTIVITY','SHOP')
  );

alter table public.composer_badge_bindings
  drop constraint composer_badge_bindings_category_check,
  add constraint composer_badge_bindings_category_check check (
    category in ('GROCERIES','BAKERY','RESTAURANT','BAR','HAIRDRESSER','BEAUTY','CLOTHING','HOME','ACTIVITY','SHOP')
  );
