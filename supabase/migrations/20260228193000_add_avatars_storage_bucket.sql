-- Create storage bucket policies for profile avatars used by backend upload endpoint.
--
-- Bucket provisioning itself is handled outside SQL migrations because the
-- hosted storage schema is owned by supabase_storage_admin. Local buckets are
-- defined in supabase/config.toml, and remote buckets are provisioned with a
-- storage admin script.

drop policy if exists "read all in avatars" on storage.objects;
drop policy if exists "upload authenticated sets owner (avatars)" on storage.objects;
drop policy if exists "delete own or admin (avatars)" on storage.objects;

create policy "read all in avatars" on storage.objects
  for select
  using (bucket_id = 'avatars');

create policy "upload authenticated sets owner (avatars)" on storage.objects
  for insert
  with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and owner::text = auth.uid()::text
  );

create policy "delete own or admin (avatars)" on storage.objects
  for delete
  using (
    bucket_id = 'avatars'
    and (owner::text = auth.uid()::text or public.is_admin(auth.uid()))
  );
