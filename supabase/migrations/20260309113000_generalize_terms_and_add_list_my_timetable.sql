do $$ begin
  alter type public.term_season add value 'quarter_1';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type public.term_season add value 'quarter_2';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type public.term_season add value 'quarter_3';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type public.term_season add value 'quarter_4';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type public.term_season add value 'full_year';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type public.term_season add value 'intensive';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type public.term_season add value 'other';
exception when duplicate_object then null; end $$;

alter table public.terms
  add column if not exists academic_year int,
  add column if not exists code text,
  add column if not exists display_name text,
  add column if not exists sort_key int;

update public.terms
set
  academic_year = coalesce(academic_year, year),
  code = coalesce(
    nullif(code, ''),
    case season::text
      when 'first_half' then 'first_half'
      when 'second_half' then 'second_half'
      when 'quarter_1' then 'quarter_1'
      when 'quarter_2' then 'quarter_2'
      when 'quarter_3' then 'quarter_3'
      when 'quarter_4' then 'quarter_4'
      when 'full_year' then 'full_year'
      when 'intensive' then 'intensive'
      else 'other'
    end
  ),
  display_name = coalesce(
    nullif(display_name, ''),
    case season::text
      when 'first_half' then '前期'
      when 'second_half' then '後期'
      when 'quarter_1' then '1学期'
      when 'quarter_2' then '2学期'
      when 'quarter_3' then '3学期'
      when 'quarter_4' then '4学期'
      when 'full_year' then '通年'
      when 'intensive' then '集中'
      else 'その他'
    end
  ),
  sort_key = coalesce(
    sort_key,
    case season::text
      when 'first_half' then 10
      when 'quarter_1' then 10
      when 'quarter_2' then 20
      when 'second_half' then 20
      when 'quarter_3' then 30
      when 'quarter_4' then 40
      when 'full_year' then 50
      when 'intensive' then 60
      else 999
    end
  );

alter table public.terms
  alter column academic_year set not null,
  alter column code set not null,
  alter column display_name set not null,
  alter column sort_key set not null;

alter table public.terms
  drop constraint if exists terms_university_id_year_season_key;

create unique index if not exists terms_university_academic_year_code_unique
  on public.terms(university_id, academic_year, code);

create index if not exists terms_university_sort_idx
  on public.terms(university_id, academic_year desc, sort_key desc);

create or replace function public.list_my_timetable(
  _term_id uuid,
  _include_dropped boolean default false
)
returns table (
  term_id uuid,
  term_academic_year int,
  term_code text,
  term_display_name text,
  term_sort_key int,
  offering_id uuid,
  course_title text,
  instructor text,
  status public.enrollment_status,
  created_at timestamptz,
  day_of_week smallint,
  period smallint,
  start_time time,
  room text,
  is_unslotted boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _viewer_university_id uuid;
  _term_university_id uuid;
begin
  if _uid is null then
    raise exception using errcode = 'P0001', message = 'authentication_required';
  end if;

  select p.university_id
    into _viewer_university_id
  from public.profiles p
  where p.user_id = _uid;

  select t.university_id
    into _term_university_id
  from public.terms t
  where t.id = _term_id;

  if _viewer_university_id is null or _term_university_id is distinct from _viewer_university_id then
    return;
  end if;

  return query
  select
    t.id as term_id,
    t.academic_year as term_academic_year,
    t.code as term_code,
    t.display_name as term_display_name,
    t.sort_key as term_sort_key,
    o.id as offering_id,
    c.name as course_title,
    o.instructor,
    e.status,
    e.created_at,
    s.day_of_week,
    s.period,
    s.start_time,
    s.room,
    (s.id is null or s.day_of_week is null or s.period is null) as is_unslotted
  from public.enrollments e
  join public.course_offerings o on o.id = e.offering_id
  join public.courses c on c.id = o.course_id
  join public.terms t on t.id = o.term_id
  left join public.offering_slots s on s.offering_id = o.id
  where e.user_id = _uid
    and o.term_id = _term_id
    and (_include_dropped or e.status in ('enrolled', 'planned'))
  order by
    e.created_at asc,
    o.id asc,
    s.day_of_week nulls last,
    s.period nulls last,
    s.created_at asc;
end;
$$;

grant execute on function public.list_my_timetable(uuid, boolean) to authenticated;
