-- Follow relationships and follow notifications.
-- - Introduce one-way follows separate from legacy connections.
-- - Store follower/following counts in user_stats for lightweight profile reads.
-- - Clean up follow edges automatically when a block is created.

alter table public.user_stats
  add column if not exists followers_count int not null default 0,
  add column if not exists following_count int not null default 0;

create table if not exists public.follows (
  follower_user_id uuid not null references auth.users(id) on delete cascade,
  following_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_user_id, following_user_id),
  check (follower_user_id <> following_user_id)
);

create index if not exists follows_following_created_idx
  on public.follows(following_user_id, created_at desc, follower_user_id);

create index if not exists follows_follower_created_idx
  on public.follows(follower_user_id, created_at desc, following_user_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('follow')),
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_created_idx
  on public.notifications(recipient_user_id, created_at desc);

insert into public.user_stats (user_id)
select p.user_id
from public.profiles p
left join public.user_stats us on us.user_id = p.user_id
where us.user_id is null;

update public.user_stats us
set
  followers_count = coalesce(
    (
      select count(*)
      from public.follows f
      where f.following_user_id = us.user_id
    ),
    0
  ),
  following_count = coalesce(
    (
      select count(*)
      from public.follows f
      where f.follower_user_id = us.user_id
    ),
    0
  );

create or replace function public.user_stats_apply_follow_delta(
  _uid uuid,
  _followers_delta int,
  _following_delta int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _uid is null then
    return;
  end if;

  insert into public.user_stats (user_id, followers_count, following_count)
  values (
    _uid,
    greatest(coalesce(_followers_delta, 0), 0),
    greatest(coalesce(_following_delta, 0), 0)
  )
  on conflict (user_id) do update
    set followers_count = greatest(public.user_stats.followers_count + coalesce(_followers_delta, 0), 0),
        following_count = greatest(public.user_stats.following_count + coalesce(_following_delta, 0), 0);
end;
$$;

create or replace function public.follow_user(_following_user_id uuid)
returns table (
  is_following boolean,
  followers_count int,
  following_count int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  _current_user_id uuid := auth.uid();
begin
  if _current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if _following_user_id is null then
    raise exception 'follow_target_required';
  end if;

  if _current_user_id = _following_user_id then
    raise exception 'cannot_follow_self';
  end if;

  if public.is_blocked(_current_user_id, _following_user_id) then
    raise exception 'follow_blocked';
  end if;
-- 注意: ON CONFLICT DO NOTHING の場合、INSERTは行われず handle_follow_change トリガーも発火しない。
-- しかし is_following は true を返し、followers/following_count は現在の（変更なしの）値を返す。
-- これで「すでにフォロー済み」の場合も正しいレスポンスになる。
-- race conditionのリスクはPostgreSQLのトランザクション保証により極めて低い。
  insert into public.follows (follower_user_id, following_user_id)
  values (_current_user_id, _following_user_id)
  on conflict (follower_user_id, following_user_id) do nothing;

  return query
  select
    exists (
      select 1
      from public.follows f
      where f.follower_user_id = _current_user_id
        and f.following_user_id = _following_user_id
    ) as is_following,
    coalesce(us.followers_count, 0) as followers_count,
    coalesce(us.following_count, 0) as following_count
  from (select _following_user_id as target_user_id) target
  left join public.user_stats us on us.user_id = target.target_user_id;
end;
$$;

create or replace function public.unfollow_user(_following_user_id uuid)
returns table (
  is_following boolean,
  followers_count int,
  following_count int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  _current_user_id uuid := auth.uid();
begin
  if _current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if _following_user_id is null then
    raise exception 'follow_target_required';
  end if;

  delete from public.follows
  where follower_user_id = _current_user_id
    and following_user_id = _following_user_id;

  return query
  select
    exists (
      select 1
      from public.follows f
      where f.follower_user_id = _current_user_id
        and f.following_user_id = _following_user_id
    ) as is_following,
    coalesce(us.followers_count, 0) as followers_count,
    coalesce(us.following_count, 0) as following_count
  from (select _following_user_id as target_user_id) target
  left join public.user_stats us on us.user_id = target.target_user_id;
end;
$$;

create or replace function public.get_follow_summary(_target_user_id uuid)
returns table (
  followers_count int,
  following_count int,
  is_following boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(us.followers_count, 0) as followers_count,
    coalesce(us.following_count, 0) as following_count,
    exists (
      select 1
      from public.follows f
      where f.follower_user_id = auth.uid()
        and f.following_user_id = _target_user_id
    ) as is_following
  from (select _target_user_id as target_user_id) target
  left join public.user_stats us on us.user_id = target.target_user_id;
$$;

create or replace function public.list_follow_profiles(
  _target_user_id uuid,
  _direction text,
  _limit int default 21,
  _offset int default 0
)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  faculty text,
  department text,
  grade_year smallint,
  university_name text,
  followed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _normalized_limit int := least(greatest(coalesce(_limit, 21), 1), 101);
  _normalized_offset int := greatest(coalesce(_offset, 0), 0);
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if _direction not in ('followers', 'following') then
    raise exception 'invalid_follow_direction';
  end if;

  if _direction = 'followers' then
    return query
    select
      p.user_id,
      p.display_name,
      p.avatar_url,
      p.faculty,
      p.department,
      p.grade_year,
      u.name as university_name,
      f.created_at as followed_at
    from public.follows f
    join public.profiles p on p.user_id = f.follower_user_id
    left join public.universities u on u.id = p.university_id
    where f.following_user_id = _target_user_id
    order by f.created_at desc, p.user_id asc
    offset _normalized_offset
    limit _normalized_limit;
  else
    return query
    select
      p.user_id,
      p.display_name,
      p.avatar_url,
      p.faculty,
      p.department,
      p.grade_year,
      u.name as university_name,
      f.created_at as followed_at
    from public.follows f
    join public.profiles p on p.user_id = f.following_user_id
    left join public.universities u on u.id = p.university_id
    where f.follower_user_id = _target_user_id
    order by f.created_at desc, p.user_id asc
    offset _normalized_offset
    limit _normalized_limit;
  end if;
end;
$$;

create or replace function public.handle_follow_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.user_stats_apply_follow_delta(new.follower_user_id, 0, 1);
    perform public.user_stats_apply_follow_delta(new.following_user_id, 1, 0);

    insert into public.notifications (
      recipient_user_id,
      actor_user_id,
      type,
      payload
    )
    values (
      new.following_user_id,
      new.follower_user_id,
      'follow',
      '{}'::jsonb
    );

    return new;
  end if;

  perform public.user_stats_apply_follow_delta(old.follower_user_id, 0, -1);
  perform public.user_stats_apply_follow_delta(old.following_user_id, -1, 0);

  return old;
end;
$$;

create or replace function public.cleanup_follows_on_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.follows
  where (follower_user_id = new.blocker_id and following_user_id = new.blocked_id)
     or (follower_user_id = new.blocked_id and following_user_id = new.blocker_id);

  return new;
end;
$$;

drop trigger if exists follows_apply_side_effects on public.follows;
create trigger follows_apply_side_effects
after insert or delete on public.follows
for each row execute function public.handle_follow_change();

drop trigger if exists blocks_cleanup_follows on public.blocks;
create trigger blocks_cleanup_follows
after insert on public.blocks
for each row execute function public.cleanup_follows_on_block();

alter table public.follows enable row level security;
alter table public.notifications enable row level security;

drop policy if exists notifications_select_recipient on public.notifications;
create policy notifications_select_recipient on public.notifications
for select to authenticated
using (recipient_user_id = auth.uid());

drop policy if exists notifications_update_recipient on public.notifications;
create policy notifications_update_recipient on public.notifications
for update to authenticated
using (recipient_user_id = auth.uid())
with check (recipient_user_id = auth.uid());

revoke all on function public.user_stats_apply_follow_delta(uuid, int, int) from public;
revoke all on function public.user_stats_apply_follow_delta(uuid, int, int) from anon;
revoke all on function public.user_stats_apply_follow_delta(uuid, int, int) from authenticated;

revoke all on function public.follow_user(uuid) from public;
revoke all on function public.follow_user(uuid) from anon;
revoke all on function public.follow_user(uuid) from authenticated;
grant execute on function public.follow_user(uuid) to authenticated;

revoke all on function public.unfollow_user(uuid) from public;
revoke all on function public.unfollow_user(uuid) from anon;
revoke all on function public.unfollow_user(uuid) from authenticated;
grant execute on function public.unfollow_user(uuid) to authenticated;

revoke all on function public.get_follow_summary(uuid) from public;
revoke all on function public.get_follow_summary(uuid) from anon;
revoke all on function public.get_follow_summary(uuid) from authenticated;
grant execute on function public.get_follow_summary(uuid) to authenticated;

revoke all on function public.list_follow_profiles(uuid, text, int, int) from public;
revoke all on function public.list_follow_profiles(uuid, text, int, int) from anon;
revoke all on function public.list_follow_profiles(uuid, text, int, int) from authenticated;
grant execute on function public.list_follow_profiles(uuid, text, int, int) to authenticated;

revoke all on function public.handle_follow_change() from public;
revoke all on function public.handle_follow_change() from anon;
revoke all on function public.handle_follow_change() from authenticated;

revoke all on function public.cleanup_follows_on_block() from public;
revoke all on function public.cleanup_follows_on_block() from anon;
revoke all on function public.cleanup_follows_on_block() from authenticated;
