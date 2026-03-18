-- Notes images must not be publicly readable because note visibility is
-- governed by application-level access rules (public / university / offering_only / private).
-- Keep the bucket private and serve images via signed URLs generated after note access checks.

update storage.buckets
set public = false
where id = 'notes';

drop policy if exists "read all in notes" on storage.objects;

-- Keep upload/delete policies intact for authenticated owners and admins.
