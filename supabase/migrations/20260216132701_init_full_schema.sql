-- =========================================================
-- StudyShare schema v1 (Supabase/Postgres)
-- Core: Course / Offering / Enrollment separation
-- Features: notes, reviews, timetable, matching (safe), dm, footprints, profiles, blocks, reports, gating, basic entitlements
-- =========================================================

-- 0) Extensions
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- 1) Enums
do $$ begin
  create type public.term_season as enum ('spring','summer','fall','winter');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.gender as enum ('male','female','other','unspecified');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.enrollment_status as enum ('enrolled','planned','dropped');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.enrollment_visibility as enum ('private','match_only','public');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.note_visibility as enum ('public','university','offering_only','private');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.dm_scope as enum ('any','shared_offering','connections');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.connection_status as enum ('requested','accepted','rejected','blocked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.subscription_status as enum ('active','trialing','past_due','canceled','incomplete');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_target_type as enum ('user','note','review','message');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.review_difficulty as enum ('very_easy','easy','normal','hard','very_hard','unknown');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.review_content as enum ('poor','ok','good','excellent','unknown');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.review_attendance as enum ('none','sometimes','often','always','unknown');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.review_grading as enum ('test_only','report_only','both','other','unknown');
exception when duplicate_object then null; end $$;

-- 2) Common helper functions / triggers

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 3) Auth / roles

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','moderator')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin(_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = _uid and r.role = 'admin'
  );
$$;

-- 4) University / term / course / offering

create table if not exists public.universities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.terms (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  year int not null,
  season public.term_season not null,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  unique(university_id, year, season)
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  course_code text,              -- if available
  name text not null,
  credits numeric,
  description text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists courses_univ_code_unique
  on public.courses(university_id, course_code)
  where course_code is not null;

create index if not exists courses_univ_name_idx
  on public.courses(university_id, name);

create trigger courses_touch_updated_at
before update on public.courses
for each row execute function public.touch_updated_at();

create table if not exists public.course_offerings (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  term_id uuid not null references public.terms(id) on delete cascade,
  section text,                  -- class/section identifier if exists
  instructor text,
  syllabus_url text,
  language text,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists course_offerings_course_term_idx
  on public.course_offerings(course_id, term_id);

create trigger course_offerings_touch_updated_at
before update on public.course_offerings
for each row execute function public.touch_updated_at();

create table if not exists public.offering_slots (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.course_offerings(id) on delete cascade,
  day_of_week smallint check (day_of_week between 1 and 7), -- null for intensive
  period smallint check (period between 1 and 30),
  start_time time,
  end_time time,
  campus text,
  room text,
  created_at timestamptz not null default now()
);

create index if not exists offering_slots_offering_idx
  on public.offering_slots(offering_id);

-- 5) Profiles / stats

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  university_id uuid references public.universities(id),
  display_name text not null,
  handle text, -- optional @id
  avatar_url text,
  gender public.gender not null default 'unspecified',
  grade_year smallint,
  faculty text,
  department text,
  bio text,
  dm_scope public.dm_scope not null default 'shared_offering',
  allow_dm boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_univ_handle_unique
  on public.profiles(university_id, handle)
  where handle is not null;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

create table if not exists public.user_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  notes_count int not null default 0,
  reviews_count int not null default 0,
  contributions_count int generated always as (notes_count + reviews_count) stored,
  last_contribution_at timestamptz
);

-- helper: user university
create or replace function public.user_university_id(_uid uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.university_id from public.profiles p where p.user_id = _uid;
$$;

-- 6) Enrollments (user timetable is a relation to offering)

create table if not exists public.enrollments (
  user_id uuid not null references auth.users(id) on delete cascade,
  offering_id uuid not null references public.course_offerings(id) on delete cascade,
  status public.enrollment_status not null default 'enrolled',
  visibility public.enrollment_visibility not null default 'match_only',
  created_at timestamptz not null default now(),
  primary key(user_id, offering_id)
);

create index if not exists enrollments_offering_idx on public.enrollments(offering_id);
create index if not exists enrollments_user_idx on public.enrollments(user_id);

create or replace function public.is_enrolled(_uid uuid, _offering_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.enrollments e
    where e.user_id = _uid
      and e.offering_id = _offering_id
      and e.status in ('enrolled','planned')
  );
$$;

-- 7) Notes

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.course_offerings(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body_md text,
  week int,
  tags text[] not null default '{}',
  visibility public.note_visibility not null default 'university',
  search_tsv tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists notes_offering_created_idx
  on public.notes(offering_id, created_at desc);

create index if not exists notes_author_created_idx
  on public.notes(author_id, created_at desc);

create index if not exists notes_search_tsv_idx
  on public.notes using gin (search_tsv);

create index if not exists notes_tags_gin_idx
  on public.notes using gin (tags);

create trigger notes_touch_updated_at
before update on public.notes
for each row execute function public.touch_updated_at();

create or replace function public.notes_set_search_tsv()
returns trigger
language plpgsql
as $$
begin
  new.search_tsv :=
    to_tsvector(
      'simple',
      unaccent(coalesce(new.title,'') || ' ' || coalesce(new.body_md,'') || ' ' || array_to_string(new.tags,' '))
    );
  return new;
end;
$$;

create trigger notes_search_tsv_trigger
before insert or update of title, body_md, tags
on public.notes
for each row execute function public.notes_set_search_tsv();

create table if not exists public.note_assets (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  storage_path text not null,
  mime text,
  bytes bigint,
  created_at timestamptz not null default now()
);

create index if not exists note_assets_note_idx on public.note_assets(note_id);

create table if not exists public.note_reactions (
  note_id uuid not null references public.notes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'like',
  created_at timestamptz not null default now(),
  primary key(note_id, user_id, kind)
);

create table if not exists public.note_comments (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists note_comments_note_created_idx on public.note_comments(note_id, created_at desc);

-- 8) Reviews (Rakutan-like) - tie to offering to avoid mis-match

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.course_offerings(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  rating_overall smallint not null check (rating_overall between 1 and 5),
  difficulty public.review_difficulty not null default 'unknown',
  content public.review_content not null default 'unknown',
  attendance public.review_attendance not null default 'unknown',
  grading public.review_grading not null default 'unknown',
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger reviews_touch_updated_at
before update on public.reviews
for each row execute function public.touch_updated_at();

-- one active review per (author, offering)
create unique index if not exists reviews_author_offering_unique_active
  on public.reviews(author_id, offering_id)
  where deleted_at is null;

create index if not exists reviews_offering_created_idx on public.reviews(offering_id, created_at desc);

-- 9) Stats maintenance (notes/reviews counters)
create or replace function public.user_stats_apply_delta(_uid uuid, _notes_delta int, _reviews_delta int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_stats(user_id, notes_count, reviews_count, last_contribution_at)
  values (_uid, greatest(_notes_delta,0), greatest(_reviews_delta,0), now())
  on conflict (user_id) do update
    set notes_count = greatest(public.user_stats.notes_count + _notes_delta, 0),
        reviews_count = greatest(public.user_stats.reviews_count + _reviews_delta, 0),
        last_contribution_at = now();
end;
$$;

create or replace function public.notes_stats_trigger()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.deleted_at is null then
      perform public.user_stats_apply_delta(new.author_id, 1, 0);
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    -- soft delete / restore
    if old.deleted_at is null and new.deleted_at is not null then
      perform public.user_stats_apply_delta(new.author_id, -1, 0);
    elsif old.deleted_at is not null and new.deleted_at is null then
      perform public.user_stats_apply_delta(new.author_id, 1, 0);
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.deleted_at is null then
      perform public.user_stats_apply_delta(old.author_id, -1, 0);
    end if;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists notes_stats_trg on public.notes;
create trigger notes_stats_trg
after insert or update of deleted_at or delete on public.notes
for each row execute function public.notes_stats_trigger();

create or replace function public.reviews_stats_trigger()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.deleted_at is null then
      perform public.user_stats_apply_delta(new.author_id, 0, 1);
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if old.deleted_at is null and new.deleted_at is not null then
      perform public.user_stats_apply_delta(new.author_id, 0, -1);
    elsif old.deleted_at is not null and new.deleted_at is null then
      perform public.user_stats_apply_delta(new.author_id, 0, 1);
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.deleted_at is null then
      perform public.user_stats_apply_delta(old.author_id, 0, -1);
    end if;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists reviews_stats_trg on public.reviews;
create trigger reviews_stats_trg
after insert or update of deleted_at or delete on public.reviews
for each row execute function public.reviews_stats_trigger();

-- 10) Entitlements / subscriptions (for monetization & overrides)

create table if not exists public.entitlements (
  key text primary key,
  description text
);

insert into public.entitlements(key, description) values
  ('messaging', 'Can send direct messages'),
  ('footprints', 'Can view footprints list')
on conflict do nothing;

create table if not exists public.user_entitlements (
  user_id uuid not null references auth.users(id) on delete cascade,
  entitlement_key text not null references public.entitlements(key) on delete cascade,
  active boolean not null default true,
  source text not null default 'earned', -- earned/purchase/subscription/admin
  expires_at timestamptz,
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  primary key(user_id, entitlement_key)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'manual',
  status public.subscription_status not null default 'incomplete',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger subscriptions_touch_updated_at
before update on public.subscriptions
for each row execute function public.touch_updated_at();

create or replace function public.has_active_entitlement(_uid uuid, _key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.user_entitlements ue
      where ue.user_id = _uid
        and ue.entitlement_key = _key
        and ue.active = true
        and (ue.expires_at is null or ue.expires_at > now())
    )
    or exists (
      select 1
      from public.subscriptions s
      where s.user_id = _uid
        and s.status in ('active','trialing')
        and (s.current_period_end is null or s.current_period_end > now())
    );
$$;

-- gate rule: 2+ contributions OR entitlement/subscription
create or replace function public.can_send_message(_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select us.contributions_count from public.user_stats us where us.user_id=_uid),0) >= 2
    or public.has_active_entitlement(_uid, 'messaging');
$$;

create or replace function public.can_view_footprints(_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select us.contributions_count from public.user_stats us where us.user_id=_uid),0) >= 2
    or public.has_active_entitlement(_uid, 'footprints');
$$;

-- 11) Safety: blocks, reports

create table if not exists public.blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create or replace function public.is_blocked(_a uuid, _b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks b
    where (b.blocker_id=_a and b.blocked_id=_b)
       or (b.blocker_id=_b and b.blocked_id=_a)
  );
$$;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type public.report_target_type not null,
  target_id uuid not null,
  reason text,
  created_at timestamptz not null default now()
);

-- 12) Footprints (profile views)
create table if not exists public.profile_views (
  id uuid primary key default gen_random_uuid(),
  viewer_id uuid not null references auth.users(id) on delete cascade,
  viewed_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (viewer_id <> viewed_id)
);

create index if not exists profile_views_viewed_created_idx
  on public.profile_views(viewed_id, created_at desc);

-- 13) Connections (optional “match” layer)
create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status public.connection_status not null default 'requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> addressee_id),
  unique(requester_id, addressee_id)
);

create trigger connections_touch_updated_at
before update on public.connections
for each row execute function public.touch_updated_at();

-- 14) Matching (SAFE) - return only aggregated matches, not raw enrollments

create or replace function public.shared_offering_count(_a uuid, _b uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)
  from public.enrollments e1
  join public.enrollments e2 on e1.offering_id = e2.offering_id
  where e1.user_id = _a
    and e2.user_id = _b
    and e1.status = 'enrolled'
    and e2.status = 'enrolled'
    and e1.visibility in ('match_only','public')
    and e2.visibility in ('match_only','public');
$$;

create or replace function public.find_match_candidates(_limit int default 50, _min_shared int default 1)
returns table (
  matched_user_id uuid,
  shared_offering_count int,
  display_name text,
  avatar_url text,
  faculty text,
  department text
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (select auth.uid() as uid),
  shared as (
    select
      e2.user_id as matched_user_id,
      count(*)::int as shared_offering_count
    from me
    join public.enrollments e1 on e1.user_id = me.uid
    join public.enrollments e2 on e1.offering_id = e2.offering_id
    where e2.user_id <> me.uid
      and e1.status='enrolled' and e2.status='enrolled'
      and e1.visibility in ('match_only','public')
      and e2.visibility in ('match_only','public')
    group by e2.user_id
  )
  select
    s.matched_user_id,
    s.shared_offering_count,
    p.display_name,
    p.avatar_url,
    p.faculty,
    p.department
  from shared s
  join public.profiles p on p.user_id = s.matched_user_id
  where s.shared_offering_count >= _min_shared
  order by s.shared_offering_count desc
  limit _limit;
$$;

-- 15) Direct messaging (DM)
-- DM scope rules live in can_dm()

create or replace function public.connection_accepted(_a uuid, _b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.connections c
    where (
      (c.requester_id=_a and c.addressee_id=_b)
      or (c.requester_id=_b and c.addressee_id=_a)
    )
    and c.status='accepted'
  );
$$;

create or replace function public.can_dm(_sender uuid, _recipient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with r as (
    select p.allow_dm, p.dm_scope
    from public.profiles p
    where p.user_id = _recipient
  )
  select
    _sender is not null
    and _recipient is not null
    and _sender <> _recipient
    and not public.is_blocked(_sender, _recipient)
    and public.can_send_message(_sender)
    and coalesce((select allow_dm from r), true) = true
    and (
      (select dm_scope from r) = 'any'
      or ((select dm_scope from r) = 'shared_offering' and public.shared_offering_count(_sender, _recipient) >= 1)
      or ((select dm_scope from r) = 'connections' and public.connection_accepted(_sender, _recipient) = true)
    );
$$;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct')),
  direct_key text unique, -- deterministic: "uid_small:uid_large"
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key(conversation_id, user_id)
);

create index if not exists conversation_members_user_idx on public.conversation_members(user_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists messages_conversation_created_idx
  on public.messages(conversation_id, created_at desc);

-- RPC: create (or fetch) direct conversation with other user
create or replace function public.create_direct_conversation(_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  a uuid;
  b uuid;
  dkey text;
  cid uuid;
begin
  if not public.can_dm(me, _other_user_id) then
    raise exception 'not allowed';
  end if;

  a := least(me, _other_user_id);
  b := greatest(me, _other_user_id);
  dkey := a::text || ':' || b::text;

  select c.id into cid
  from public.conversations c
  where c.direct_key = dkey;

  if cid is null then
    insert into public.conversations(kind, direct_key, created_by)
    values ('direct', dkey, me)
    returning id into cid;

    insert into public.conversation_members(conversation_id, user_id)
    values (cid, me), (cid, _other_user_id);
  end if;

  return cid;
end;
$$;

-- =========================================================
-- RLS (Row Level Security)
-- =========================================================

-- Enable RLS
alter table public.user_roles enable row level security;
alter table public.universities enable row level security;
alter table public.terms enable row level security;
alter table public.courses enable row level security;
alter table public.course_offerings enable row level security;
alter table public.offering_slots enable row level security;

alter table public.profiles enable row level security;
alter table public.user_stats enable row level security;

alter table public.enrollments enable row level security;

alter table public.notes enable row level security;
alter table public.note_assets enable row level security;
alter table public.note_reactions enable row level security;
alter table public.note_comments enable row level security;

alter table public.reviews enable row level security;

alter table public.user_entitlements enable row level security;
alter table public.entitlements enable row level security;
alter table public.subscriptions enable row level security;

alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.profile_views enable row level security;

alter table public.connections enable row level security;

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

-- 1) Read-mostly public master data
-- universities/terms/courses/offering/slots: allow SELECT to everyone (LP and app)
drop policy if exists universities_select_all on public.universities;
create policy universities_select_all on public.universities
for select using (true);

drop policy if exists terms_select_all on public.terms;
create policy terms_select_all on public.terms
for select using (true);

drop policy if exists courses_select_all on public.courses;
create policy courses_select_all on public.courses
for select using (true);

drop policy if exists offerings_select_all on public.course_offerings;
create policy offerings_select_all on public.course_offerings
for select using (true);

drop policy if exists slots_select_all on public.offering_slots;
create policy slots_select_all on public.offering_slots
for select using (true);

-- Insert/update master data: authenticated can INSERT (crowd), UPDATE/DELETE only admin
drop policy if exists courses_insert_auth on public.courses;
create policy courses_insert_auth on public.courses
for insert to authenticated
with check (auth.uid() is not null and created_by = auth.uid());

drop policy if exists courses_update_admin on public.courses;
create policy courses_update_admin on public.courses
for update to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists courses_delete_admin on public.courses;
create policy courses_delete_admin on public.courses
for delete to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists offerings_insert_auth on public.course_offerings;
create policy offerings_insert_auth on public.course_offerings
for insert to authenticated
with check (auth.uid() is not null and created_by = auth.uid());

drop policy if exists offerings_update_admin on public.course_offerings;
create policy offerings_update_admin on public.course_offerings
for update to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists offerings_delete_admin on public.course_offerings;
create policy offerings_delete_admin on public.course_offerings
for delete to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists slots_insert_auth on public.offering_slots;
create policy slots_insert_auth on public.offering_slots
for insert to authenticated
with check (auth.uid() is not null);

drop policy if exists slots_update_admin on public.offering_slots;
create policy slots_update_admin on public.offering_slots
for update to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists slots_delete_admin on public.offering_slots;
create policy slots_delete_admin on public.offering_slots
for delete to authenticated
using (public.is_admin(auth.uid()));

-- 2) Profiles
drop policy if exists profiles_select_auth on public.profiles;
create policy profiles_select_auth on public.profiles
for select to authenticated
using (true);

drop policy if exists profiles_upsert_self on public.profiles;
create policy profiles_upsert_self on public.profiles
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- user_stats: readable by authenticated (for UI like “投稿数”)
drop policy if exists user_stats_select_auth on public.user_stats;
create policy user_stats_select_auth on public.user_stats
for select to authenticated
using (true);

-- 3) Enrollments: private (only owner can read/write)
drop policy if exists enrollments_select_self on public.enrollments;
create policy enrollments_select_self on public.enrollments
for select to authenticated
using (user_id = auth.uid());

drop policy if exists enrollments_insert_self on public.enrollments;
create policy enrollments_insert_self on public.enrollments
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists enrollments_update_self on public.enrollments;
create policy enrollments_update_self on public.enrollments
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists enrollments_delete_self on public.enrollments;
create policy enrollments_delete_self on public.enrollments
for delete to authenticated
using (user_id = auth.uid());

-- 4) Notes visibility
-- public: all
-- university/offering_only: authenticated (and same university) or author
-- private: author only
create or replace function public.can_view_note(_uid uuid, _note public.notes)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    _note.deleted_at is null
    and (
      _note.visibility = 'public'
      or (_uid is not null and _note.author_id = _uid)
      or (
        _uid is not null
        and _note.visibility in ('university','offering_only')
        and public.user_university_id(_uid) is not null
        and public.user_university_id(_uid) =
            (select c.university_id
             from public.course_offerings o
             join public.courses c on c.id = o.course_id
             where o.id = _note.offering_id
             limit 1)
      )
    );
$$;

drop policy if exists notes_select_by_visibility on public.notes;
create policy notes_select_by_visibility on public.notes
for select
using (public.can_view_note(auth.uid(), notes));

-- Notes insert: must be author and enrolled/planned in offering
drop policy if exists notes_insert_enrolled on public.notes;
create policy notes_insert_enrolled on public.notes
for insert to authenticated
with check (
  author_id = auth.uid()
  and public.is_enrolled(auth.uid(), offering_id)
);

-- Notes update/delete: author only (admin can moderate separately later)
drop policy if exists notes_update_author on public.notes;
create policy notes_update_author on public.notes
for update to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());

drop policy if exists notes_delete_author on public.notes;
create policy notes_delete_author on public.notes
for delete to authenticated
using (author_id = auth.uid());

-- note_assets: same visibility as note (select) / author inserts
drop policy if exists note_assets_select on public.note_assets;
create policy note_assets_select on public.note_assets
for select
using (
  exists (
    select 1 from public.notes n
    where n.id = note_assets.note_id
      and public.can_view_note(auth.uid(), n)
  )
);

drop policy if exists note_assets_insert_author on public.note_assets;
create policy note_assets_insert_author on public.note_assets
for insert to authenticated
with check (
  exists (
    select 1 from public.notes n
    where n.id = note_assets.note_id
      and n.author_id = auth.uid()
  )
);

-- reactions/comments: authenticated + can view note
drop policy if exists note_reactions_select on public.note_reactions;
create policy note_reactions_select on public.note_reactions
for select to authenticated
using (
  exists (select 1 from public.notes n where n.id = note_reactions.note_id and public.can_view_note(auth.uid(), n))
);

drop policy if exists note_reactions_insert_self on public.note_reactions;
create policy note_reactions_insert_self on public.note_reactions
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists note_comments_select on public.note_comments;
create policy note_comments_select on public.note_comments
for select to authenticated
using (
  exists (select 1 from public.notes n where n.id = note_comments.note_id and public.can_view_note(auth.uid(), n))
);

drop policy if exists note_comments_insert_self on public.note_comments;
create policy note_comments_insert_self on public.note_comments
for insert to authenticated
with check (author_id = auth.uid());

drop policy if exists note_comments_update_self on public.note_comments;
create policy note_comments_update_self on public.note_comments
for update to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());

-- 5) Reviews
create or replace function public.can_view_review(_uid uuid, _review public.reviews)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    _review.deleted_at is null
    and (
      _uid is not null
      and public.user_university_id(_uid) =
        (select c.university_id
         from public.course_offerings o
         join public.courses c on c.id=o.course_id
         where o.id=_review.offering_id
         limit 1)
      or _review.author_id = _uid
    );
$$;

drop policy if exists reviews_select_same_univ on public.reviews;
create policy reviews_select_same_univ on public.reviews
for select to authenticated
using (public.can_view_review(auth.uid(), reviews));

drop policy if exists reviews_insert_enrolled on public.reviews;
create policy reviews_insert_enrolled on public.reviews
for insert to authenticated
with check (
  author_id = auth.uid()
  and public.is_enrolled(auth.uid(), offering_id)
);

drop policy if exists reviews_update_author on public.reviews;
create policy reviews_update_author on public.reviews
for update to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());

-- 6) Entitlements / subscriptions: self-readable
drop policy if exists entitlements_select_all on public.entitlements;
create policy entitlements_select_all on public.entitlements
for select using (true);

drop policy if exists user_entitlements_select_self on public.user_entitlements;
create policy user_entitlements_select_self on public.user_entitlements
for select to authenticated
using (user_id = auth.uid());

drop policy if exists subscriptions_select_self on public.subscriptions;
create policy subscriptions_select_self on public.subscriptions
for select to authenticated
using (user_id = auth.uid());

-- (granting entitlements/subscriptions should be done server-side with service role; no client insert policy)

-- 7) Blocks: self-manage
drop policy if exists blocks_select_self on public.blocks;
create policy blocks_select_self on public.blocks
for select to authenticated
using (blocker_id = auth.uid());

drop policy if exists blocks_insert_self on public.blocks;
create policy blocks_insert_self on public.blocks
for insert to authenticated
with check (blocker_id = auth.uid());

drop policy if exists blocks_delete_self on public.blocks;
create policy blocks_delete_self on public.blocks
for delete to authenticated
using (blocker_id = auth.uid());

-- 8) Reports: user can insert, only admin can select
drop policy if exists reports_insert_auth on public.reports;
create policy reports_insert_auth on public.reports
for insert to authenticated
with check (reporter_id = auth.uid());

drop policy if exists reports_select_admin on public.reports;
create policy reports_select_admin on public.reports
for select to authenticated
using (public.is_admin(auth.uid()));

-- 9) Footprints: always insert by viewer; select only viewed user AND unlocked
drop policy if exists profile_views_insert_viewer on public.profile_views;
create policy profile_views_insert_viewer on public.profile_views
for insert to authenticated
with check (viewer_id = auth.uid());

drop policy if exists profile_views_select_viewed_unlocked on public.profile_views;
create policy profile_views_select_viewed_unlocked on public.profile_views
for select to authenticated
using (
  viewed_id = auth.uid()
  and public.can_view_footprints(auth.uid())
);

-- 10) Connections: only involved users can see; requester inserts; addressee can accept/reject
drop policy if exists connections_select_involved on public.connections;
create policy connections_select_involved on public.connections
for select to authenticated
using (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists connections_insert_requester on public.connections;
create policy connections_insert_requester on public.connections
for insert to authenticated
with check (requester_id = auth.uid());

drop policy if exists connections_update_involved on public.connections;
create policy connections_update_involved on public.connections
for update to authenticated
using (requester_id = auth.uid() or addressee_id = auth.uid())
with check (requester_id = auth.uid() or addressee_id = auth.uid());

-- 11) Messaging: select only members. Create conversations via RPC (no insert policy).
drop policy if exists conversations_select_member on public.conversations;
create policy conversations_select_member on public.conversations
for select to authenticated
using (
  exists (
    select 1 from public.conversation_members m
    where m.conversation_id = conversations.id
      and m.user_id = auth.uid()
  )
);

drop policy if exists conversation_members_select_member on public.conversation_members;
create policy conversation_members_select_member on public.conversation_members
for select to authenticated
using (
  exists (
    select 1 from public.conversation_members m
    where m.conversation_id = conversation_members.conversation_id
      and m.user_id = auth.uid()
  )
);

-- allow member to update their last_read_at
drop policy if exists conversation_members_update_self on public.conversation_members;
create policy conversation_members_update_self on public.conversation_members
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists messages_select_member on public.messages;
create policy messages_select_member on public.messages
for select to authenticated
using (
  exists (
    select 1 from public.conversation_members m
    where m.conversation_id = messages.conversation_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists messages_insert_sender on public.messages;
create policy messages_insert_sender on public.messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.conversation_members m
    where m.conversation_id = messages.conversation_id
      and m.user_id = auth.uid()
  )
  and public.can_send_message(auth.uid())
);

-- =========================================================
-- End
-- =========================================================
