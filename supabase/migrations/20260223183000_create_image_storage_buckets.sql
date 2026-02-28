-- Create storage buckets for image uploads used by backend upload endpoints.
-- `notes` is the active bucket for note image attachments.
-- `assignments` is kept for backward compatibility with legacy upload endpoints.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'notes',
    'notes',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']::text[]
  ),
  (
    'assignments',
    'assignments',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']::text[]
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

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
    and owner_id::text = auth.uid()::text
  );

create policy "delete own or admin (notes)" on storage.objects
  for delete
  using (
    bucket_id = 'notes'
    and (owner_id::text = auth.uid()::text or public.is_admin(auth.uid()))
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
    and owner_id::text = auth.uid()::text
  );

create policy "delete own or admin (assignments)" on storage.objects
  for delete
  using (
    bucket_id = 'assignments'
    and (owner_id::text = auth.uid()::text or public.is_admin(auth.uid()))
  );
