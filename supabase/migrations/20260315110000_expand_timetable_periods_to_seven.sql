create or replace function public.expand_timetable_periods_to_seven(_periods jsonb)
returns jsonb
language sql
immutable
as $$
  with recursive
  existing as (
    select
      (entry->>'period')::int as period,
      entry->>'label' as label,
      (entry->>'start_time')::time as start_time,
      (entry->>'end_time')::time as end_time
    from jsonb_array_elements(coalesce(_periods, '[]'::jsonb)) as entry
    where (entry->>'period') ~ '^[0-9]+$'
  ),
  stats as (
    select
      coalesce(
        (
          select greatest(1, (extract(epoch from (end_time - start_time)) / 60)::int)
          from existing
          order by period desc
          limit 1
        ),
        100
      ) as duration_minutes,
      coalesce(
        (
          select greatest(0, (extract(epoch from (current_period.start_time - previous_period.end_time)) / 60)::int)
          from existing as current_period
          join existing as previous_period
            on previous_period.period = current_period.period - 1
          order by current_period.period desc
          limit 1
        ),
        5
      ) as gap_minutes
  ),
  completed as (
    select
      1 as period,
      coalesce(first_period.label, '1限') as label,
      coalesce(first_period.start_time, time '09:00') as start_time,
      coalesce(first_period.end_time, time '10:40') as end_time
    from stats
    left join existing as first_period on first_period.period = 1

    union all

    select
      previous.period + 1 as period,
      coalesce(current_period.label, format('%s限', previous.period + 1)) as label,
      coalesce(
        current_period.start_time,
        (previous.end_time + make_interval(mins => stats.gap_minutes))::time
      ) as start_time,
      coalesce(
        current_period.end_time,
        (
          coalesce(
            current_period.start_time,
            (previous.end_time + make_interval(mins => stats.gap_minutes))::time
          ) + make_interval(mins => stats.duration_minutes)
        )::time
      ) as end_time
    from completed as previous
    cross join stats
    left join existing as current_period on current_period.period = previous.period + 1
    where previous.period < 7
  )
  select jsonb_agg(
    jsonb_build_object(
      'period', periods.period,
      'label', periods.label,
      'start_time', to_char(periods.start_time, 'HH24:MI'),
      'end_time', to_char(periods.end_time, 'HH24:MI')
    )
    order by periods.period
  )
  from (
    select period, label, start_time, end_time
    from completed

    union all

    select period, label, start_time, end_time
    from existing
    where period > 7
  ) as periods;
$$;

update public.timetable_presets
set periods = public.expand_timetable_periods_to_seven(periods)
where exists (
  select 1
  from generate_series(1, 7) as required(period)
  where not exists (
    select 1
    from jsonb_array_elements(periods) as entry
    where (entry->>'period') ~ '^[0-9]+$'
      and (entry->>'period')::int = required.period
  )
);

update public.profile_timetable_settings
set periods = public.expand_timetable_periods_to_seven(periods)
where exists (
  select 1
  from generate_series(1, 7) as required(period)
  where not exists (
    select 1
    from jsonb_array_elements(periods) as entry
    where (entry->>'period') ~ '^[0-9]+$'
      and (entry->>'period')::int = required.period
  )
);
