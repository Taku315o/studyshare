create or replace function public.upsert_enrollment(
  _offering_id uuid,
  _status public.enrollment_status default 'enrolled'
)
returns table (
  offering_id uuid,
  previous_status public.enrollment_status,
  status public.enrollment_status,
  visibility public.enrollment_visibility,
  was_inserted boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _default_visibility public.enrollment_visibility := 'match_only';
  _previous_status public.enrollment_status;
  _existing_visibility public.enrollment_visibility;
begin
  if _uid is null then
    raise exception using errcode = 'P0001', message = 'authentication_required';
  end if;

  if not exists (
    select 1
    from public.course_offerings o
    where o.id = _offering_id
  ) then
    raise exception using errcode = 'P0001', message = 'offering_not_found';
  end if;

  select p.enrollment_visibility_default
    into _default_visibility
  from public.profiles p
  where p.user_id = _uid;

  select e.status, e.visibility
    into _previous_status, _existing_visibility
  from public.enrollments e
  where e.user_id = _uid
    and e.offering_id = _offering_id;

  return query
  with upserted as (
    insert into public.enrollments as enrollment_row (
      user_id,
      offering_id,
      status,
      visibility
    )
    values (
      _uid,
      _offering_id,
      coalesce(_status, 'enrolled'),
      coalesce(_existing_visibility, _default_visibility, 'match_only')
    )
    on conflict (user_id, offering_id) do update
      set status = excluded.status
    returning
      enrollment_row.offering_id as inserted_offering_id,
      enrollment_row.status as inserted_status,
      enrollment_row.visibility as inserted_visibility
  )
  select
    upserted.inserted_offering_id,
    _previous_status,
    upserted.inserted_status,
    upserted.inserted_visibility,
    _previous_status is null
  from upserted;
end;
$$;

grant execute on function public.upsert_enrollment(uuid, public.enrollment_status) to authenticated;
