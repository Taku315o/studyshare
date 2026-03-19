create or replace function public.sync_profile_timetable_settings_to_presets()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_rows integer := 0;
begin
  update public.profile_timetable_settings as settings
  set
    weekdays = preset.weekdays,
    periods = preset.periods,
    updated_at = now()
  from public.timetable_presets as preset
  where settings.preset_id = preset.id
    and (
      settings.weekdays is distinct from preset.weekdays
      or settings.periods is distinct from preset.periods
    );

  get diagnostics affected_rows = row_count;
  return affected_rows;
end;
$$;

comment on function public.sync_profile_timetable_settings_to_presets() is
  'Re-sync preset-linked user timetable settings after timetable_presets master data changes.';

select public.sync_profile_timetable_settings_to_presets();
