-- Private visual preferences. No Canonical, Draft, Plan or financial writer.
create table public.composer_badge_visuals (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  identity_key text not null check (
    identity_key = 'platform:amazon'
    or identity_key ~ '^(merchant|place|personal):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ),
  label text not null check (length(btrim(label)) between 1 and 120),
  category text check (category in ('GROCERIES','RESTAURANT','BAR','HAIRDRESSER','BEAUTY','CLOTHING','HOME','ACTIVITY','SHOP')),
  object_path text,
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, identity_key),
  check (object_path is null or object_path ~ ('^' || user_id::text || '/[0-9a-f-]{36}[.]webp$'))
);
create table public.composer_badge_bindings (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  anchor_key text not null check (anchor_key ~ '^(seller|provider|place):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  source_digest text not null check (source_digest ~ '^[0-9a-f]{64}$'),
  identity_key text,
  category text check (category in ('GROCERIES','RESTAURANT','BAR','HAIRDRESSER','BEAUTY','CLOTHING','HOME','ACTIVITY','SHOP')),
  version integer not null default 1 check (version > 0),
  primary key (user_id, anchor_key),
  foreign key (user_id, identity_key) references public.composer_badge_visuals(user_id, identity_key)
);
alter table public.composer_badge_visuals enable row level security;
alter table public.composer_badge_bindings enable row level security;
revoke all on public.composer_badge_visuals, public.composer_badge_bindings from public, anon;
grant select, insert, update, delete on public.composer_badge_visuals, public.composer_badge_bindings to authenticated;
create policy badge_visual_owner on public.composer_badge_visuals to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy badge_binding_owner on public.composer_badge_bindings to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('composer-badge-illustrations', 'composer-badge-illustrations', false, 2097152, array['image/webp']);
create policy badge_image_read on storage.objects for select to authenticated
  using (bucket_id = 'composer-badge-illustrations' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy badge_image_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'composer-badge-illustrations' and (storage.foldername(name))[1] = (select auth.uid())::text
    and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}[.]webp$'));
create policy badge_image_delete on storage.objects for delete to authenticated
  using (bucket_id = 'composer-badge-illustrations' and (storage.foldername(name))[1] = (select auth.uid())::text);
