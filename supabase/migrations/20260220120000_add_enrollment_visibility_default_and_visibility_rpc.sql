alter table public.profiles
add column if not exists enrollment_visibility_default public.enrollment_visibility not null default 'match_only';

create or replace function public.update_visibility_settings(new_visibility public.enrollment_visibility)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  update public.profiles
  set enrollment_visibility_default = new_visibility
  where user_id = uid;

  if not found then
    raise exception 'profile not found for user %', uid;
  end if;

  update public.enrollments
  set visibility = new_visibility
  where user_id = uid;
end;
$$;

revoke all on function public.update_visibility_settings(public.enrollment_visibility) from public;
grant execute on function public.update_visibility_settings(public.enrollment_visibility) to authenticated;
