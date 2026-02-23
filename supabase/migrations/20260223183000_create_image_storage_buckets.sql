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
