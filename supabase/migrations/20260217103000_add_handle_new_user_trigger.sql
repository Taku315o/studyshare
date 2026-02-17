-- Auth user creation hook for current schema (profiles/user_stats/user_roles)
-- - Keeps migration history additive (do not reuse _broken migrations)
-- - Idempotent re-runnable SQL

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_display_name text;
begin
  v_role := coalesce(
    nullif(new.raw_user_meta_data->>'role', ''),
    nullif(new.raw_app_meta_data->>'role', '')
  );

  v_display_name := coalesce(
    nullif(new.raw_user_meta_data->>'display_name', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    nullif(split_part(new.email, '@', 1), ''),
    'user'
  );

  insert into public.profiles (user_id, display_name)
  values (new.id, v_display_name)
  on conflict (user_id) do nothing;

  insert into public.user_stats (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  if v_role in ('admin', 'moderator') then
    insert into public.user_roles (user_id, role)
    values (new.id, v_role)
    on conflict (user_id) do update
      set role = excluded.role;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill existing auth users who are missing profile/stats/role rows
insert into public.profiles (user_id, display_name)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data->>'display_name', ''),
    nullif(u.raw_user_meta_data->>'name', ''),
    nullif(split_part(u.email, '@', 1), ''),
    'user'
  )
from auth.users u
left join public.profiles p on p.user_id = u.id
where p.user_id is null;

insert into public.user_stats (user_id)
select u.id
from auth.users u
left join public.user_stats s on s.user_id = u.id
where s.user_id is null;

insert into public.user_roles (user_id, role)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data->>'role', ''),
    nullif(u.raw_app_meta_data->>'role', '')
  ) as role
from auth.users u
left join public.user_roles r on r.user_id = u.id
where r.user_id is null
  and coalesce(
    nullif(u.raw_user_meta_data->>'role', ''),
    nullif(u.raw_app_meta_data->>'role', '')
  ) in ('admin', 'moderator');
