create table if not exists public.offering_catalog_coverages (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  term_id uuid not null references public.terms(id) on delete cascade,
  import_source_id uuid not null references public.import_sources(id) on delete cascade,
  coverage_kind text not null,
  source_scope_labels text[] not null default '{}'::text[],
  latest_run_id uuid references public.import_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offering_catalog_coverages_kind_check
    check (coverage_kind in ('partial', 'full')),
  constraint offering_catalog_coverages_term_source_unique
    unique (term_id, import_source_id)
);

create index if not exists offering_catalog_coverages_university_idx
  on public.offering_catalog_coverages(university_id);

create trigger offering_catalog_coverages_touch_updated_at
before update on public.offering_catalog_coverages
for each row execute function public.touch_updated_at();

alter table public.offering_catalog_coverages enable row level security;

drop policy if exists offering_catalog_coverages_select_same_university on public.offering_catalog_coverages;
create policy offering_catalog_coverages_select_same_university on public.offering_catalog_coverages
for select using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.university_id = offering_catalog_coverages.university_id
  )
);

drop policy if exists offering_catalog_coverages_insert_admin on public.offering_catalog_coverages;
create policy offering_catalog_coverages_insert_admin on public.offering_catalog_coverages
for insert with check (public.is_admin(auth.uid()));

drop policy if exists offering_catalog_coverages_update_admin on public.offering_catalog_coverages;
create policy offering_catalog_coverages_update_admin on public.offering_catalog_coverages
for update using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists offering_catalog_coverages_delete_admin on public.offering_catalog_coverages;
create policy offering_catalog_coverages_delete_admin on public.offering_catalog_coverages
for delete using (public.is_admin(auth.uid()));

create index if not exists course_offerings_term_active_created_idx
  on public.course_offerings(term_id, is_active, created_at desc);

create index if not exists courses_name_search_trgm_idx
  on public.courses using gin (public.normalize_offering_text(name) gin_trgm_ops);

create index if not exists courses_code_search_trgm_idx
  on public.courses using gin (public.normalize_offering_text(coalesce(course_code, '')) gin_trgm_ops);

create index if not exists course_offerings_instructor_search_trgm_idx
  on public.course_offerings using gin (public.normalize_offering_text(coalesce(instructor, '')) gin_trgm_ops);

create or replace function public.search_timetable_offerings(
  _term_id uuid,
  _day_of_week smallint default null,
  _period smallint default null,
  _query text default null,
  _limit int default 30,
  _offset int default 0
)
returns table (
  offering_id uuid,
  course_title text,
  course_code text,
  instructor text,
  room text,
  slot_labels text[],
  slot_details jsonb,
  slot_match boolean,
  enrollment_count int,
  my_status public.enrollment_status,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _viewer_university_id uuid;
  _term_university_id uuid;
  _normalized_query text := public.normalize_offering_text(_query);
  _normalized_limit int := least(greatest(coalesce(_limit, 30), 1), 100);
  _normalized_offset int := greatest(coalesce(_offset, 0), 0);
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
  with targeted_offerings as (
    select
      o.id as offering_id,
      c.name as course_title,
      c.course_code,
      o.instructor,
      o.created_at
    from public.course_offerings o
    join public.courses c on c.id = o.course_id
    join public.terms t on t.id = o.term_id
    where o.term_id = _term_id
      and o.is_active = true
      and t.university_id = _viewer_university_id
  ),
  slot_agg as (
    select
      s.offering_id,
      array_agg(
        case
          when s.slot_kind = 'weekly_structured' and s.day_of_week is not null and s.period is not null then
            format(
              '%s曜 %s限',
              case s.day_of_week
                when 1 then '月'
                when 2 then '火'
                when 3 then '水'
                when 4 then '木'
                when 5 then '金'
                when 6 then '土'
                when 7 then '日'
                else '?'
              end,
              coalesce(s.period::text, '?')
            )
          else coalesce(nullif(btrim(s.raw_text), ''), '集中・日時未定')
        end
        order by s.day_of_week nulls last, s.period nulls last, s.created_at asc
      ) as slot_labels,
      jsonb_agg(
        jsonb_build_object(
          'dayOfWeek', s.day_of_week,
          'period', s.period,
          'room', s.room
        )
        order by s.day_of_week nulls last, s.period nulls last, s.created_at asc
      ) as slot_details,
      array_to_string(
        array_remove(array_agg(distinct nullif(btrim(s.room), '')), null),
        ' / '
      ) as room,
      bool_or(
        s.slot_kind = 'weekly_structured'
        and _day_of_week is not null
        and _period is not null
        and s.day_of_week = _day_of_week
        and s.period = _period
      ) as slot_match
    from public.offering_slots s
    join targeted_offerings target on target.offering_id = s.offering_id
    group by s.offering_id
  ),
  enrollment_counts as (
    select
      e.offering_id,
      count(*)::int as enrollment_count
    from public.enrollments e
    join targeted_offerings target on target.offering_id = e.offering_id
    where e.status = 'enrolled'
    group by e.offering_id
  ),
  scoped as (
    select
      target.offering_id,
      target.course_title,
      target.course_code,
      target.instructor,
      sa.room,
      coalesce(sa.slot_labels, array[]::text[]) as slot_labels,
      coalesce(sa.slot_details, '[]'::jsonb) as slot_details,
      coalesce(sa.slot_match, false) as slot_match,
      coalesce(ec.enrollment_count, 0) as enrollment_count,
      my_enrollment.status as my_status,
      target.created_at,
      case
        when _normalized_query = '' then 0
        when public.normalize_offering_text(target.course_title) = _normalized_query then 4
        when public.normalize_offering_text(coalesce(target.course_code, '')) = _normalized_query then 4
        when public.normalize_offering_text(coalesce(target.instructor, '')) = _normalized_query then 3
        when public.normalize_offering_text(target.course_title) like '%' || _normalized_query || '%' then 3
        when public.normalize_offering_text(coalesce(target.instructor, '')) like '%' || _normalized_query || '%' then 2
        when similarity(public.normalize_offering_text(target.course_title), _normalized_query) >= 0.4 then 1
        else 0
      end as text_rank
    from targeted_offerings target
    left join slot_agg sa on sa.offering_id = target.offering_id
    left join enrollment_counts ec on ec.offering_id = target.offering_id
    left join public.enrollments my_enrollment
      on my_enrollment.offering_id = target.offering_id
     and my_enrollment.user_id = _uid
    where (
      _normalized_query = ''
      or public.normalize_offering_text(target.course_title) like '%' || _normalized_query || '%'
      or public.normalize_offering_text(coalesce(target.course_code, '')) like '%' || _normalized_query || '%'
      or public.normalize_offering_text(coalesce(target.instructor, '')) like '%' || _normalized_query || '%'
      or similarity(public.normalize_offering_text(target.course_title), _normalized_query) >= 0.4
    )
  )
  select
    scoped.offering_id,
    scoped.course_title,
    scoped.course_code,
    scoped.instructor,
    scoped.room,
    scoped.slot_labels,
    scoped.slot_details,
    scoped.slot_match,
    scoped.enrollment_count,
    scoped.my_status,
    scoped.created_at
  from scoped
  order by
    scoped.slot_match desc,
    scoped.text_rank desc,
    scoped.enrollment_count desc,
    scoped.created_at desc
  offset _normalized_offset
  limit _normalized_limit;
end;
$$;

create or replace function public.suggest_offering_duplicates(
  _term_id uuid,
  _course_title text,
  _instructor text default null,
  _day_of_week smallint default null,
  _period smallint default null,
  _limit int default 8
)
returns table (
  offering_id uuid,
  course_title text,
  course_code text,
  instructor text,
  room text,
  slot_labels text[],
  slot_details jsonb,
  slot_match boolean,
  enrollment_count int,
  my_status public.enrollment_status,
  created_at timestamptz,
  candidate_kind text,
  reasons text[]
)
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _viewer_university_id uuid;
  _term_university_id uuid;
  _normalized_title text := public.normalize_offering_text(_course_title);
  _normalized_instructor text := public.normalize_offering_text(_instructor);
  _normalized_limit int := least(greatest(coalesce(_limit, 8), 1), 20);
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
  with targeted_offerings as (
    select
      o.id as offering_id,
      c.name as course_title,
      c.course_code,
      o.instructor,
      o.created_at
    from public.course_offerings o
    join public.courses c on c.id = o.course_id
    join public.terms t on t.id = o.term_id
    where o.term_id = _term_id
      and o.is_active = true
      and t.university_id = _viewer_university_id
  ),
  slot_agg as (
    select
      s.offering_id,
      array_agg(
        case
          when s.slot_kind = 'weekly_structured' and s.day_of_week is not null and s.period is not null then
            format(
              '%s曜 %s限',
              case s.day_of_week
                when 1 then '月'
                when 2 then '火'
                when 3 then '水'
                when 4 then '木'
                when 5 then '金'
                when 6 then '土'
                when 7 then '日'
                else '?'
              end,
              coalesce(s.period::text, '?')
            )
          else coalesce(nullif(btrim(s.raw_text), ''), '集中・日時未定')
        end
        order by s.day_of_week nulls last, s.period nulls last, s.created_at asc
      ) as slot_labels,
      jsonb_agg(
        jsonb_build_object(
          'dayOfWeek', s.day_of_week,
          'period', s.period,
          'room', s.room
        )
        order by s.day_of_week nulls last, s.period nulls last, s.created_at asc
      ) as slot_details,
      array_to_string(
        array_remove(array_agg(distinct nullif(btrim(s.room), '')), null),
        ' / '
      ) as room,
      bool_or(
        s.slot_kind = 'weekly_structured'
        and _day_of_week is not null
        and _period is not null
        and s.day_of_week = _day_of_week
        and s.period = _period
      ) as same_slot
    from public.offering_slots s
    join targeted_offerings target on target.offering_id = s.offering_id
    group by s.offering_id
  ),
  enrollment_counts as (
    select
      e.offering_id,
      count(*)::int as enrollment_count
    from public.enrollments e
    join targeted_offerings target on target.offering_id = e.offering_id
    where e.status = 'enrolled'
    group by e.offering_id
  ),
  candidate_rows as (
    select
      target.offering_id,
      target.course_title,
      target.course_code,
      target.instructor,
      sa.room,
      coalesce(sa.slot_labels, array[]::text[]) as slot_labels,
      coalesce(sa.slot_details, '[]'::jsonb) as slot_details,
      coalesce(sa.same_slot, false) as slot_match,
      coalesce(ec.enrollment_count, 0) as enrollment_count,
      my_enrollment.status as my_status,
      target.created_at,
      public.normalize_offering_text(target.course_title) = _normalized_title as same_title,
      similarity(public.normalize_offering_text(target.course_title), _normalized_title) >= 0.4 as similar_title,
      public.normalize_offering_text(coalesce(target.instructor, '')) = _normalized_instructor as same_instructor
    from targeted_offerings target
    left join slot_agg sa on sa.offering_id = target.offering_id
    left join enrollment_counts ec on ec.offering_id = target.offering_id
    left join public.enrollments my_enrollment
      on my_enrollment.offering_id = target.offering_id
     and my_enrollment.user_id = _uid
    where (
      _normalized_title = ''
      or public.normalize_offering_text(target.course_title) like '%' || _normalized_title || '%'
      or similarity(public.normalize_offering_text(target.course_title), _normalized_title) >= 0.4
      or public.normalize_offering_text(coalesce(target.instructor, '')) = _normalized_instructor
      or (
        _day_of_week is not null
        and _period is not null
        and coalesce(sa.same_slot, false)
      )
    )
  ),
  classified as (
    select
      candidate_rows.offering_id,
      candidate_rows.course_title,
      candidate_rows.course_code,
      candidate_rows.instructor,
      candidate_rows.room,
      candidate_rows.slot_labels,
      candidate_rows.slot_details,
      candidate_rows.slot_match,
      candidate_rows.enrollment_count,
      candidate_rows.my_status,
      candidate_rows.created_at,
      case
        when candidate_rows.slot_match and candidate_rows.same_title and (candidate_rows.same_instructor or _normalized_instructor = '')
          then 'exact'
        when candidate_rows.slot_match and (candidate_rows.same_title or candidate_rows.similar_title or candidate_rows.same_instructor)
          then 'strong'
        when candidate_rows.same_title or candidate_rows.similar_title or candidate_rows.same_instructor or candidate_rows.slot_match
          then 'related'
        else null
      end as candidate_kind,
      array_remove(
        array[
          case when candidate_rows.same_title then '同一授業名' end,
          case when candidate_rows.similar_title and not candidate_rows.same_title then '類似授業名' end,
          case when candidate_rows.same_instructor and _normalized_instructor <> '' then '同一教員' end,
          case when candidate_rows.slot_match then '同一曜日・限' end
        ],
        null
      ) as reasons
    from candidate_rows
  )
  select
    classified.offering_id,
    classified.course_title,
    classified.course_code,
    classified.instructor,
    classified.room,
    classified.slot_labels,
    classified.slot_details,
    classified.slot_match,
    classified.enrollment_count,
    classified.my_status,
    classified.created_at,
    classified.candidate_kind,
    classified.reasons
  from classified
  where classified.candidate_kind is not null
  order by
    case classified.candidate_kind
      when 'exact' then 3
      when 'strong' then 2
      when 'related' then 1
      else 0
    end desc,
    classified.slot_match desc,
    classified.enrollment_count desc,
    classified.created_at desc
  limit _normalized_limit;
end;
$$;
