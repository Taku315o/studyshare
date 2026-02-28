-- Create storage bucket for profile avatars used by backend upload endpoint.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "read all in avatars" on storage.objects;
drop policy if exists "upload authenticated sets owner (avatars)" on storage.objects;
drop policy if exists "delete own or admin (avatars)" on storage.objects;

create policy "read all in avatars" on storage.objects
  for select
  using (bucket_id = 'avatars');

create policy "upload authenticated sets owner (avatars)" on storage.objects
  for insert
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated' and owner_id = auth.uid());

create policy "delete own or admin (avatars)" on storage.objects
  for delete
  using (
    bucket_id = 'avatars'
    and (owner_id = auth.uid() or public.is_admin(auth.uid()))
  );
