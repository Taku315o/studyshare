-- Dev-only offering sample.
-- This file is intentionally excluded from supabase/config.toml default seed list.
-- Apply it explicitly when you need local UI data for offerings / timetable flows.

with
u as (
  insert into public.universities (name)
  values ('専修大学')
  on conflict (name) do update set name = excluded.name
  returning id
),
u2 as (
  select id from u
  union all
  select id from public.universities where name = '専修大学' limit 1
),
t as (
  insert into public.terms (
    university_id,
    year,
    season,
    academic_year,
    code,
    display_name,
    sort_key,
    start_date,
    end_date
  )
  select id, 2025, 'second_half', 2025, 'second_half', '後期', 20, '2025-09-16', '2026-01-31' from u2
  on conflict (university_id, academic_year, code)
  do update set
    start_date = excluded.start_date,
    end_date = excluded.end_date,
    display_name = excluded.display_name,
    sort_key = excluded.sort_key
  returning id, university_id
),
t2 as (
  select id, university_id from t
  union all
  select tr.id, tr.university_id
  from public.terms tr
  join u2 on u2.id = tr.university_id
  where tr.academic_year = 2025 and tr.code = 'second_half'
  limit 1
),
c as (
  insert into public.courses (university_id, course_code, name, created_by)
  select t2.university_id, 'ICT216', '応用プログラミング３', auth.uid()
  from t2
  where not exists (
    select 1
    from public.courses co
    where co.university_id = t2.university_id
      and co.course_code = 'ICT216'
  )
  returning id, course_code
),
c2 as (
  select id, course_code from c
  union all
  select co.id, co.course_code
  from public.courses co
  join t2 on t2.university_id = co.university_id
  where co.course_code = 'ICT216'
  limit 1
),
o as (
  insert into public.course_offerings (course_id, term_id, section, instructor, created_by)
  select c2.id, t2.id, null, '田中 健太', auth.uid()
  from c2
  cross join t2
  where not exists (
    select 1
    from public.course_offerings o
    where o.course_id = c2.id
      and o.term_id = t2.id
      and coalesce(o.section, '') = ''
      and o.instructor = '田中 健太'
  )
  returning id
),
o2 as (
  select id from o
  union all
  select o.id
  from public.course_offerings o
  join c2 on c2.id = o.course_id
  join t2 on t2.id = o.term_id
  where coalesce(o.section, '') = ''
    and o.instructor = '田中 健太'
  limit 1
)
insert into public.offering_slots (offering_id, day_of_week, period)
select o2.id, 4, 5
from o2
where not exists (
  select 1
  from public.offering_slots s
  where s.offering_id = o2.id
    and s.day_of_week = 4
    and s.period = 5
);
