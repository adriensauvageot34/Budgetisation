begin;

-- A PurchaseEvent carries the source's classification even when its effective
-- economic owner is an existing Operation. These references do not change
-- Operation banking truth or create a second economic owner.
alter table public.purchase_events
  add column merchant_id uuid references public.merchants (merchant_id),
  add column category_id uuid references public.categories (category_id),
  add column subcategory_id uuid references public.subcategories (subcategory_id),
  add column need_id uuid references public.needs (need_id),
  add column semantic_purpose text;

commit;
