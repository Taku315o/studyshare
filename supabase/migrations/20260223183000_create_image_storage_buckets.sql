-- Create storage bucket policies for note images and legacy assignments uploads.
--
-- Bucket provisioning itself is handled outside SQL migrations because the
-- hosted storage schema is owned by supabase_storage_admin. Local buckets are
-- defined in supabase/config.toml, and remote buckets are provisioned with a
-- storage admin script.

-- RLS policies for storage.objects
-- Drop existing policies to avoid conflicts on re-run.
drop policy if exists "read all in notes" on storage.objects;
drop policy if exists "upload authenticated sets owner (notes)" on storage.objects;
drop policy if exists "delete own or admin (notes)" on storage.objects;
drop policy if exists "read all in assignments" on storage.objects;
drop policy if exists "upload authenticated sets owner (assignments)" on storage.objects;
drop policy if exists "delete own or admin (assignments)" on storage.objects;

-- notes bucket policies
create policy "read all in notes" on storage.objects
  for select
  using (bucket_id = 'notes');

create policy "upload authenticated sets owner (notes)" on storage.objects
  for insert
  with check (
    bucket_id = 'notes'
    and auth.role() = 'authenticated'
    and owner::text = auth.uid()::text
  );

create policy "delete own or admin (notes)" on storage.objects
  for delete
  using (
    bucket_id = 'notes'
    and (owner::text = auth.uid()::text or public.is_admin(auth.uid()))
  );

-- assignments bucket policies
create policy "read all in assignments" on storage.objects
  for select
  using (bucket_id = 'assignments');

create policy "upload authenticated sets owner (assignments)" on storage.objects
  for insert
  with check (
    bucket_id = 'assignments'
    and auth.role() = 'authenticated'
    and owner::text = auth.uid()::text
  );

create policy "delete own or admin (assignments)" on storage.objects
  for delete
  using (
    bucket_id = 'assignments'
    and (owner::text = auth.uid()::text or public.is_admin(auth.uid()))
  );
