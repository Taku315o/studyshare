-- Seed: 専修大学 / 2025後期 / ICT216 応用プログラミング３ / 木6 / 演習(オンライン) / 田中 健太

with
-- 1) university
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

-- 2) term (2025 後期)
t as (
  insert into public.terms (university_id, year, season, start_date, end_date)
  select id, 2025, 'second_half', '2025-09-16', '2026-01-31' from u2
  on conflict (university_id, year, season)
  do update set start_date = excluded.start_date, end_date = excluded.end_date
  returning id, university_id
),
t2 as (
  select id, university_id from t
  union all
  select tr.id, tr.university_id
  from public.terms tr
  join u2 on u2.id = tr.university_id
  where tr.year = 2025 and tr.season = 'second_half'
  limit 1
),

-- 3) course (恒久的な科目枠)
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
)

-- 4) offering (その学期・その教員の実体)
insert into public.course_offerings (course_id, term_id, section, instructor, created_by)
select c2.id, t2.id, null, '田中 健太', auth.uid()
from c2
cross join t2
where not exists (
  select 1
  from public.course_offerings o
  where o.course_id = c2.id
    and o.term_id = t2.id
    and coalesce(o.section, '') = coalesce(null, '')
    and o.instructor = '田中 健太'
);
