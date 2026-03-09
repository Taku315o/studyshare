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
  select id, y.year, s.season::public.term_season, y.year, s.season, s.display_name, s.sort_key, (y.year || s.start_date)::date, (y.year + s.year_offset || s.end_date)::date
  from u2
  cross join (values (2025), (2026)) as y(year)
  cross join (values
    ('first_half', '前期', 10, '-04-01', 0, '-08-31'),
    ('second_half', '後期', 20, '-09-15', 1, '-01-31'),
    ('quarter_1', '1学期', 10, '-04-01', 0, '-05-31'),
    ('quarter_2', '2学期', 20, '-06-01', 0, '-07-31'),
    ('quarter_3', '3学期', 30, '-09-15', 0, '-11-15'),
    ('quarter_4', '4学期', 40, '-11-16', 1, '-01-31'),
    ('full_year', '通年', 50, '-04-01', 1, '-01-31'),
    ('intensive', '集中', 60, null, 0, null)
  ) as s(season, display_name, sort_key, start_date, year_offset, end_date)
  on conflict (university_id, academic_year, code)
  do update set
    start_date = excluded.start_date,
    end_date = excluded.end_date,
    display_name = excluded.display_name,
    sort_key = excluded.sort_key
  returning id, university_id, academic_year, code
),
t2 as (
  select id, university_id from t
  where academic_year = 2025 and code = 'second_half'
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
