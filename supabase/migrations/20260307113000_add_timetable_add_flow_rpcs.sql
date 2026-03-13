create or replace function public.normalize_offering_text(_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select btrim(regexp_replace(lower(public.unaccent(coalesce(_value, ''))), '\s+', ' ', 'g'));
$$;

drop policy if exists courses_insert_auth on public.courses;
drop policy if exists offerings_insert_auth on public.course_offerings;
drop policy if exists slots_insert_auth on public.offering_slots;

create or replace function public.upsert_enrollment(
  _offering_id uuid,
  _status public.enrollment_status default 'enrolled'
)
returns table (
  offering_id uuid,
  previous_status public.enrollment_status,
  status public.enrollment_status,
  visibility public.enrollment_visibility,
  was_inserted boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _default_visibility public.enrollment_visibility := 'match_only';
  _previous_status public.enrollment_status;
  _existing_visibility public.enrollment_visibility;
  _result_offering_id uuid;
  _result_status public.enrollment_status;
  _result_visibility public.enrollment_visibility;
begin
  if _uid is null then
    raise exception using errcode = 'P0001', message = 'authentication_required';
  end if;

  if not exists (
    select 1
    from public.course_offerings o
    where o.id = _offering_id
  ) then
    raise exception using errcode = 'P0001', message = 'offering_not_found';
  end if;

  select p.enrollment_visibility_default
    into _default_visibility
  from public.profiles p
  where p.user_id = _uid;

  select e.status, e.visibility
    into _previous_status, _existing_visibility
  from public.enrollments e
  where e.user_id = _uid
    and e.offering_id = _offering_id;

  insert into public.enrollments as enrollment_row (
    user_id,
    offering_id,
    status,
    visibility
  )
  values (
    _uid,
    _offering_id,
    coalesce(_status, 'enrolled'),
    coalesce(_existing_visibility, _default_visibility, 'match_only')
  )
  on conflict on constraint enrollments_pkey do update
    set status = excluded.status
  returning
    enrollment_row.offering_id,
    enrollment_row.status,
    enrollment_row.visibility
  into
    _result_offering_id,
    _result_status,
    _result_visibility;

  return query
  select
    _result_offering_id,
    _previous_status,
    _result_status,
    _result_visibility,
    _previous_status is null;
end;
$$;

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
  with slot_agg as (
    select
      s.offering_id,
      array_agg(
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
        order by s.day_of_week nulls last, s.period nulls last
      ) as slot_labels,
      jsonb_agg(
        jsonb_build_object(
          'dayOfWeek', s.day_of_week,
          'period', s.period,
          'room', s.room
        )
        order by s.day_of_week nulls last, s.period nulls last
      ) as slot_details,
      array_to_string(
        array_remove(array_agg(distinct nullif(btrim(s.room), '')), null),
        ' / '
      ) as room,
      bool_or(
        _day_of_week is not null
        and _period is not null
        and s.day_of_week = _day_of_week
        and s.period = _period
      ) as slot_match
    from public.offering_slots s
    group by s.offering_id
  ),
  enrollment_counts as (
    select
      e.offering_id,
      count(*)::int as enrollment_count
    from public.enrollments e
    where e.status = 'enrolled'
    group by e.offering_id
  ),
  scoped as (
    select
      o.id as offering_id,
      c.name as course_title,
      c.course_code,
      o.instructor,
      sa.room,
      coalesce(sa.slot_labels, array[]::text[]) as slot_labels,
      coalesce(sa.slot_details, '[]'::jsonb) as slot_details,
      coalesce(sa.slot_match, false) as slot_match,
      coalesce(ec.enrollment_count, 0) as enrollment_count,
      my_enrollment.status as my_status,
      o.created_at,
      case
        when _normalized_query = '' then 0
        when public.normalize_offering_text(c.name) = _normalized_query then 4
        when public.normalize_offering_text(coalesce(c.course_code, '')) = _normalized_query then 4
        when public.normalize_offering_text(coalesce(o.instructor, '')) = _normalized_query then 3
        when public.normalize_offering_text(c.name) like '%' || _normalized_query || '%' then 3
        when public.normalize_offering_text(coalesce(o.instructor, '')) like '%' || _normalized_query || '%' then 2
        when similarity(public.normalize_offering_text(c.name), _normalized_query) >= 0.4 then 1
        else 0
      end as text_rank
    from public.course_offerings o
    join public.courses c on c.id = o.course_id
    join public.terms t on t.id = o.term_id
    left join slot_agg sa on sa.offering_id = o.id
    left join enrollment_counts ec on ec.offering_id = o.id
    left join public.enrollments my_enrollment
      on my_enrollment.offering_id = o.id
     and my_enrollment.user_id = _uid
    where o.term_id = _term_id
      and t.university_id = _viewer_university_id
      and (
        _normalized_query = ''
        or public.normalize_offering_text(c.name) like '%' || _normalized_query || '%'
        or public.normalize_offering_text(coalesce(c.course_code, '')) like '%' || _normalized_query || '%'
        or public.normalize_offering_text(coalesce(o.instructor, '')) like '%' || _normalized_query || '%'
        or similarity(public.normalize_offering_text(c.name), _normalized_query) >= 0.4
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
  with slot_agg as (
    select
      s.offering_id,
      array_agg(
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
        order by s.day_of_week nulls last, s.period nulls last
      ) as slot_labels,
      jsonb_agg(
        jsonb_build_object(
          'dayOfWeek', s.day_of_week,
          'period', s.period,
          'room', s.room
        )
        order by s.day_of_week nulls last, s.period nulls last
      ) as slot_details,
      array_to_string(
        array_remove(array_agg(distinct nullif(btrim(s.room), '')), null),
        ' / '
      ) as room,
      bool_or(
        _day_of_week is not null
        and _period is not null
        and s.day_of_week = _day_of_week
        and s.period = _period
      ) as same_slot
    from public.offering_slots s
    group by s.offering_id
  ),
  enrollment_counts as (
    select
      e.offering_id,
      count(*)::int as enrollment_count
    from public.enrollments e
    where e.status = 'enrolled'
    group by e.offering_id
  ),
  candidate_rows as (
    select
      o.id as offering_id,
      c.name as course_title,
      c.course_code,
      o.instructor,
      sa.room,
      coalesce(sa.slot_labels, array[]::text[]) as slot_labels,
      coalesce(sa.slot_details, '[]'::jsonb) as slot_details,
      coalesce(sa.same_slot, false) as slot_match,
      coalesce(ec.enrollment_count, 0) as enrollment_count,
      my_enrollment.status as my_status,
      o.created_at,
      public.normalize_offering_text(c.name) = _normalized_title as same_title,
      (
        _normalized_title <> ''
        and (
          public.normalize_offering_text(c.name) like '%' || _normalized_title || '%'
          or _normalized_title like '%' || public.normalize_offering_text(c.name) || '%'
          or similarity(public.normalize_offering_text(c.name), _normalized_title) >= 0.55
        )
      ) as similar_title,
      (
        _normalized_instructor <> ''
        and public.normalize_offering_text(coalesce(o.instructor, '')) = _normalized_instructor
      ) as same_instructor
    from public.course_offerings o
    join public.courses c on c.id = o.course_id
    join public.terms t on t.id = o.term_id
    left join slot_agg sa on sa.offering_id = o.id
    left join enrollment_counts ec on ec.offering_id = o.id
    left join public.enrollments my_enrollment
      on my_enrollment.offering_id = o.id
     and my_enrollment.user_id = _uid
    where o.term_id = _term_id
      and t.university_id = _viewer_university_id
  ),
  classified as (
    select
      candidate_rows.*,
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
          case when candidate_rows.same_title then '同名' end,
          case when candidate_rows.similar_title and not candidate_rows.same_title then '類似名' end,
          case when candidate_rows.same_instructor then '同一教員' end,
          case when candidate_rows.slot_match then '同一曜日・限' end,
          '同一大学・同一学期'
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
      when 'exact' then 2
      when 'strong' then 1
      else 0
    end desc,
    classified.slot_match desc,
    classified.enrollment_count desc,
    classified.created_at desc
  limit _normalized_limit;
end;
$$;

create or replace function public.create_offering_and_enroll(
  _term_id uuid,
  _course_title text,
  _course_code text default null,
  _day_of_week smallint default null,
  _period smallint default null,
  _instructor text default null,
  _room text default null,
  _confirm_distinct boolean default false
)
returns table (
  offering_id uuid,
  day_of_week smallint,
  period smallint,
  status public.enrollment_status
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
  _normalized_code text := nullif(btrim(_course_code), '');
  _normalized_instructor text := nullif(btrim(_instructor), '');
  _normalized_room text := nullif(btrim(_room), '');
  _course_id uuid;
  _offering_id uuid;
  _slot_id uuid;
  _enrollment_status public.enrollment_status;
  _blocking_count int := 0;
begin
  if _uid is null then
    raise exception using errcode = 'P0001', message = 'authentication_required';
  end if;

  if _normalized_title = '' then
    raise exception using errcode = 'P0001', message = 'course_title_required';
  end if;

  if _day_of_week is null or _day_of_week < 1 or _day_of_week > 7 then
    raise exception using errcode = 'P0001', message = 'day_of_week_invalid';
  end if;

  if _period is null or _period < 1 then
    raise exception using errcode = 'P0001', message = 'period_invalid';
  end if;

  select p.university_id
    into _viewer_university_id
  from public.profiles p
  where p.user_id = _uid;

  select t.university_id
    into _term_university_id
  from public.terms t
  where t.id = _term_id;

  if _viewer_university_id is null then
    raise exception using errcode = 'P0001', message = 'profile_university_required';
  end if;

  if _term_university_id is null then
    raise exception using errcode = 'P0001', message = 'term_not_found';
  end if;

  if _term_university_id is distinct from _viewer_university_id then
    raise exception using errcode = 'P0001', message = 'term_university_mismatch';
  end if;

  select count(*)::int
    into _blocking_count
  from public.suggest_offering_duplicates(
    _term_id,
    _course_title,
    _normalized_instructor,
    _day_of_week,
    _period,
    8
  ) suggestion
  where suggestion.candidate_kind in ('exact', 'strong');

  if _blocking_count > 0 and not coalesce(_confirm_distinct, false) then
    raise exception using errcode = 'P0001', message = 'duplicate_candidates_exist';
  end if;

  if _normalized_code is not null then
    insert into public.courses (
      university_id,
      course_code,
      name,
      created_by
    )
    values (
      _viewer_university_id,
      _normalized_code,
      _course_title,
      _uid
    )
    on conflict (university_id, course_code)
    do update
      set name = excluded.name
    returning id into _course_id;
  end if;

  if _course_id is null then
    select c.id
      into _course_id
    from public.courses c
    where c.university_id = _viewer_university_id
      and public.normalize_offering_text(c.name) = _normalized_title
    order by c.created_at asc
    limit 1;
  end if;

  if _course_id is null then
    insert into public.courses (
      university_id,
      course_code,
      name,
      created_by
    )
    values (
      _viewer_university_id,
      _normalized_code,
      _course_title,
      _uid
    )
    returning id into _course_id;
  end if;

  select o.id
    into _offering_id
  from public.course_offerings o
  where o.course_id = _course_id
    and o.term_id = _term_id
    and public.normalize_offering_text(coalesce(o.instructor, '')) = public.normalize_offering_text(coalesce(_normalized_instructor, ''))
  order by o.created_at asc
  limit 1;

  if _offering_id is null then
    insert into public.course_offerings (
      course_id,
      term_id,
      instructor,
      created_by
    )
    values (
      _course_id,
      _term_id,
      _normalized_instructor,
      _uid
    )
    returning id into _offering_id;
  end if;

  select s.id
    into _slot_id
  from public.offering_slots s
  where s.offering_id = _offering_id
    and s.day_of_week = _day_of_week
    and s.period = _period
  limit 1;

  if _slot_id is null then
    insert into public.offering_slots (
      offering_id,
      day_of_week,
      period,
      room
    )
    values (
      _offering_id,
      _day_of_week,
      _period,
      _normalized_room
    )
    returning id into _slot_id;
  elsif _normalized_room is not null then
    update public.offering_slots
      set room = coalesce(room, _normalized_room)
    where id = _slot_id;
  end if;

  select upserted.status
    into _enrollment_status
  from public.upsert_enrollment(_offering_id, 'enrolled') upserted
  limit 1;

  return query
  select
    _offering_id,
    _day_of_week,
    _period,
    coalesce(_enrollment_status, 'enrolled'::public.enrollment_status);
end;
$$;

grant execute on function public.upsert_enrollment(uuid, public.enrollment_status) to authenticated;
grant execute on function public.search_timetable_offerings(uuid, smallint, smallint, text, int, int) to authenticated;
grant execute on function public.suggest_offering_duplicates(uuid, text, text, smallint, smallint, int) to authenticated;
grant execute on function public.create_offering_and_enroll(uuid, text, text, smallint, smallint, text, text, boolean) to authenticated;
