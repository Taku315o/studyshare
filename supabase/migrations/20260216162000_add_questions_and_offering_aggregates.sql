-- questions + offering aggregates (safe)

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.course_offerings(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists questions_offering_created_idx on public.questions(offering_id, created_at desc);

drop trigger if exists questions_touch_updated_at on public.questions;
create trigger questions_touch_updated_at
before update on public.questions
for each row execute function public.touch_updated_at();

alter table public.questions enable row level security;

create or replace function public.can_view_question(_uid uuid, _question public.questions)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    _question.deleted_at is null
    and _uid is not null
    and (
      _question.author_id = _uid
      or public.user_university_id(_uid) =
        (select c.university_id
         from public.course_offerings o
         join public.courses c on c.id = o.course_id
         where o.id = _question.offering_id
         limit 1)
    );
$$;

drop policy if exists questions_select_same_univ on public.questions;
create policy questions_select_same_univ on public.questions
for select to authenticated
using (public.can_view_question(auth.uid(), questions));

drop policy if exists questions_insert_enrolled on public.questions;
create policy questions_insert_enrolled on public.questions
for insert to authenticated
with check (
  author_id = auth.uid()
  and public.is_enrolled(auth.uid(), offering_id)
);

drop policy if exists questions_update_author on public.questions;
create policy questions_update_author on public.questions
for update to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());

drop policy if exists questions_delete_author on public.questions;
create policy questions_delete_author on public.questions
for delete to authenticated
using (author_id = auth.uid());

create or replace function public.offering_enrollment_count(_offering_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.enrollments e
  where e.offering_id = _offering_id
    and e.status = 'enrolled';
$$;

create or replace function public.offering_review_stats(_offering_id uuid)
returns table (
  avg_rating numeric,
  review_count int,
  rating_5_count int,
  rating_4_count int,
  rating_3_count int,
  rating_2_count int,
  rating_1_count int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(avg(r.rating_overall)::numeric(10,2), 0) as avg_rating,
    count(*)::int as review_count,
    count(*) filter (where r.rating_overall = 5)::int as rating_5_count,
    count(*) filter (where r.rating_overall = 4)::int as rating_4_count,
    count(*) filter (where r.rating_overall = 3)::int as rating_3_count,
    count(*) filter (where r.rating_overall = 2)::int as rating_2_count,
    count(*) filter (where r.rating_overall = 1)::int as rating_1_count
  from public.reviews r
  where r.offering_id = _offering_id
    and r.deleted_at is null;
$$;
