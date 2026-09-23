-- Portrait originals are private: only the authenticated, household-checked
-- server route may read them with the server-side secret key.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('persona-portraits', 'persona-portraits', false, 3000000, array['image/png']);
