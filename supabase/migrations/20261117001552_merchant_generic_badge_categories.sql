alter table public.merchants
  drop constraint merchants_generic_badge_category_check,
  add constraint merchants_generic_badge_category_check check (
    generic_badge_category in (
      'TOBACCO', 'BAKERY', 'PHARMACY', 'RESTAURANT', 'GROCERIES', 'BAR', 'CAFE',
      'INDIAN_RESTAURANT', 'FLORIST', 'HEALTH', 'GAS_STATION', 'SKI_RENTAL', 'HAIRDRESSER'
    )
  );

alter table public.composer_badge_visuals
  drop constraint composer_badge_visuals_category_check,
  add constraint composer_badge_visuals_category_check check (
    category in (
      'TOBACCO', 'BAKERY', 'PHARMACY', 'RESTAURANT', 'GROCERIES', 'BAR', 'CAFE',
      'INDIAN_RESTAURANT', 'FLORIST', 'HEALTH', 'GAS_STATION', 'SKI_RENTAL', 'HAIRDRESSER',
      'BEAUTY', 'CLOTHING', 'HOME', 'ACTIVITY', 'SHOP'
    )
  );

alter table public.composer_badge_bindings
  drop constraint composer_badge_bindings_category_check,
  add constraint composer_badge_bindings_category_check check (
    category in (
      'TOBACCO', 'BAKERY', 'PHARMACY', 'RESTAURANT', 'GROCERIES', 'BAR', 'CAFE',
      'INDIAN_RESTAURANT', 'FLORIST', 'HEALTH', 'GAS_STATION', 'SKI_RENTAL', 'HAIRDRESSER',
      'BEAUTY', 'CLOTHING', 'HOME', 'ACTIVITY', 'SHOP'
    )
  );
