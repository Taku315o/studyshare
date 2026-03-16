alter table public.course_offerings
  add column if not exists canonical_url text,
  add column if not exists source_updated_at timestamptz,
  add column if not exists last_seen_at timestamptz,
  add column if not exists is_active boolean not null default true;

alter table public.offering_slots
  add column if not exists slot_kind text,
  add column if not exists raw_text text;

update public.offering_slots
set slot_kind = case
  when day_of_week is not null and period is not null then 'weekly_structured'
  else 'unscheduled'
end
where slot_kind is null;

alter table public.offering_slots
  alter column slot_kind set default 'weekly_structured',
  alter column slot_kind set not null;

alter table public.offering_slots
  drop constraint if exists offering_slots_slot_kind_check;

alter table public.offering_slots
  add constraint offering_slots_slot_kind_check
  check (slot_kind in ('weekly_structured', 'intensive', 'on_demand', 'unscheduled'));

with ranked as (
  select
    id,
    row_number() over (
      partition by
        offering_id,
        slot_kind,
        coalesce(day_of_week, -1),
        coalesce(period, -1)
      order by created_at asc, id asc
    ) as row_num
  from public.offering_slots
)
delete from public.offering_slots slots
using ranked
where slots.id = ranked.id
  and ranked.row_num > 1;

drop index if exists public.offering_slots_structured_unique;
create unique index if not exists offering_slots_structured_unique
  on public.offering_slots(offering_id, day_of_week, period)
  where slot_kind = 'weekly_structured'
    and day_of_week is not null
    and period is not null;

drop index if exists public.offering_slots_non_structured_unique;
create unique index if not exists offering_slots_non_structured_unique
  on public.offering_slots(offering_id, slot_kind)
  where slot_kind in ('intensive', 'on_demand', 'unscheduled');

create table if not exists public.import_sources (
  id uuid primary key default gen_random_uuid(),
  source_code text not null unique,
  university_id uuid not null references public.universities(id) on delete cascade,
  base_url text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger import_sources_touch_updated_at
before update on public.import_sources
for each row execute function public.touch_updated_at();

create table if not exists public.import_runs (
  id uuid primary key default gen_random_uuid(),
  import_source_id uuid not null references public.import_sources(id) on delete cascade,
  scope_json jsonb not null default '{}'::jsonb,
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  stats_json jsonb not null default '{}'::jsonb,
  error_summary jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.import_runs
  drop constraint if exists import_runs_status_check;

alter table public.import_runs
  add constraint import_runs_status_check
  check (status in ('running', 'succeeded', 'failed', 'dry_run'));

create index if not exists import_runs_source_started_idx
  on public.import_runs(import_source_id, started_at desc);

create trigger import_runs_touch_updated_at
before update on public.import_runs
for each row execute function public.touch_updated_at();

create table if not exists public.raw_catalog_items (
  id uuid primary key default gen_random_uuid(),
  import_source_id uuid not null references public.import_sources(id) on delete cascade,
  external_id text not null,
  academic_year int not null,
  source_url text,
  payload_json jsonb not null,
  content_hash text not null,
  source_updated_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  latest_run_id uuid references public.import_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists raw_catalog_items_source_external_unique
  on public.raw_catalog_items(import_source_id, external_id);

create index if not exists raw_catalog_items_source_year_idx
  on public.raw_catalog_items(import_source_id, academic_year desc);

create trigger raw_catalog_items_touch_updated_at
before update on public.raw_catalog_items
for each row execute function public.touch_updated_at();

create table if not exists public.source_mappings (
  id uuid primary key default gen_random_uuid(),
  external_source text not null,
  external_id text not null,
  raw_item_id uuid references public.raw_catalog_items(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  mapping_type text not null default 'primary',
  confidence numeric(4, 3) not null default 1.000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.source_mappings
  drop constraint if exists source_mappings_entity_type_check;

alter table public.source_mappings
  add constraint source_mappings_entity_type_check
  check (entity_type in ('course', 'course_offering', 'offering_slot'));

alter table public.source_mappings
  drop constraint if exists source_mappings_mapping_type_check;

alter table public.source_mappings
  add constraint source_mappings_mapping_type_check
  check (mapping_type in ('primary', 'derived', 'manual'));

create unique index if not exists source_mappings_external_entity_unique
  on public.source_mappings(external_source, external_id, entity_type);

create index if not exists source_mappings_entity_lookup_idx
  on public.source_mappings(entity_type, entity_id);

create trigger source_mappings_touch_updated_at
before update on public.source_mappings
for each row execute function public.touch_updated_at();

alter table public.import_sources enable row level security;
alter table public.import_runs enable row level security;
alter table public.raw_catalog_items enable row level security;
alter table public.source_mappings enable row level security;

drop policy if exists import_sources_select_admin on public.import_sources;
create policy import_sources_select_admin on public.import_sources
for select using (public.is_admin(auth.uid()));

drop policy if exists import_sources_insert_admin on public.import_sources;
create policy import_sources_insert_admin on public.import_sources
for insert with check (public.is_admin(auth.uid()));

drop policy if exists import_sources_update_admin on public.import_sources;
create policy import_sources_update_admin on public.import_sources
for update using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists import_sources_delete_admin on public.import_sources;
create policy import_sources_delete_admin on public.import_sources
for delete using (public.is_admin(auth.uid()));

drop policy if exists import_runs_select_admin on public.import_runs;
create policy import_runs_select_admin on public.import_runs
for select using (public.is_admin(auth.uid()));

drop policy if exists import_runs_insert_admin on public.import_runs;
create policy import_runs_insert_admin on public.import_runs
for insert with check (public.is_admin(auth.uid()));

drop policy if exists import_runs_update_admin on public.import_runs;
create policy import_runs_update_admin on public.import_runs
for update using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists import_runs_delete_admin on public.import_runs;
create policy import_runs_delete_admin on public.import_runs
for delete using (public.is_admin(auth.uid()));

drop policy if exists raw_catalog_items_select_admin on public.raw_catalog_items;
create policy raw_catalog_items_select_admin on public.raw_catalog_items
for select using (public.is_admin(auth.uid()));

drop policy if exists raw_catalog_items_insert_admin on public.raw_catalog_items;
create policy raw_catalog_items_insert_admin on public.raw_catalog_items
for insert with check (public.is_admin(auth.uid()));

drop policy if exists raw_catalog_items_update_admin on public.raw_catalog_items;
create policy raw_catalog_items_update_admin on public.raw_catalog_items
for update using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists raw_catalog_items_delete_admin on public.raw_catalog_items;
create policy raw_catalog_items_delete_admin on public.raw_catalog_items
for delete using (public.is_admin(auth.uid()));

drop policy if exists source_mappings_select_admin on public.source_mappings;
create policy source_mappings_select_admin on public.source_mappings
for select using (public.is_admin(auth.uid()));

drop policy if exists source_mappings_insert_admin on public.source_mappings;
create policy source_mappings_insert_admin on public.source_mappings
for insert with check (public.is_admin(auth.uid()));

drop policy if exists source_mappings_update_admin on public.source_mappings;
create policy source_mappings_update_admin on public.source_mappings
for update using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists source_mappings_delete_admin on public.source_mappings;
create policy source_mappings_delete_admin on public.source_mappings
for delete using (public.is_admin(auth.uid()));

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
      and o.is_active = true
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
      similarity(public.normalize_offering_text(c.name), _normalized_title) >= 0.4 as similar_title,
      public.normalize_offering_text(coalesce(o.instructor, '')) = _normalized_instructor as same_instructor
    from public.course_offerings o
    join public.courses c on c.id = o.course_id
    join public.terms t on t.id = o.term_id
    left join slot_agg sa on sa.offering_id = o.id
    left join enrollment_counts ec on ec.offering_id = o.id
    left join public.enrollments my_enrollment
      on my_enrollment.offering_id = o.id
     and my_enrollment.user_id = _uid
    where o.term_id = _term_id
      and o.is_active = true
      and t.university_id = _viewer_university_id
      and (
        _normalized_title = ''
        or public.normalize_offering_text(c.name) like '%' || _normalized_title || '%'
        or similarity(public.normalize_offering_text(c.name), _normalized_title) >= 0.4
        or public.normalize_offering_text(coalesce(o.instructor, '')) = _normalized_instructor
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
    and s.slot_kind = 'weekly_structured'
    and s.day_of_week = _day_of_week
    and s.period = _period
  limit 1;

  if _slot_id is null then
    insert into public.offering_slots (
      offering_id,
      slot_kind,
      day_of_week,
      period,
      room
    )
    values (
      _offering_id,
      'weekly_structured',
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
