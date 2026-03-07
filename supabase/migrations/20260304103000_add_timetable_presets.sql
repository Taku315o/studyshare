create or replace function public.is_valid_timetable_weekdays(_weekdays smallint[])
returns boolean
language sql
immutable
as $$
  select
    _weekdays is not null
    and cardinality(_weekdays) between 1 and 7
    and not exists (
      select 1 from unnest(_weekdays) as d where d < 1 or d > 7
    );
$$;

create or replace function public.is_valid_timetable_periods(_periods jsonb)
returns boolean
language sql
immutable
as $$
  select
    _periods is not null
    and jsonb_typeof(_periods) = 'array'
    and jsonb_array_length(_periods) between 1 and 30
    and not exists (
      select 1
      from jsonb_array_elements(_periods) as entry
      where jsonb_typeof(entry) <> 'object'
        or not (entry ? 'period')
        or not (entry ? 'label')
        or not (entry ? 'start_time')
        or not (entry ? 'end_time')
        or not ((entry->>'period') ~ '^[0-9]+$')
        or (entry->>'period')::int not between 1 and 30
        or length(trim(coalesce(entry->>'label', ''))) = 0
        or not ((entry->>'start_time') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
        or not ((entry->>'end_time') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
    )
    and (
      select
        count(*) = count(distinct ((entry->>'period')::int))
      from jsonb_array_elements(_periods) as entry
      where (entry->>'period') ~ '^[0-9]+$'
    );
$$;

create table if not exists public.timetable_presets (
  id uuid primary key default gen_random_uuid(),
  university_id uuid references public.universities(id) on delete cascade,
  name text not null,
  weekdays smallint[] not null,
  periods jsonb not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (university_id, name),
  check (public.is_valid_timetable_weekdays(weekdays)),
  check (public.is_valid_timetable_periods(periods))
);

create unique index if not exists timetable_presets_global_default_unique
  on public.timetable_presets(name)
  where university_id is null;

create index if not exists timetable_presets_university_idx
  on public.timetable_presets(university_id);

drop trigger if exists timetable_presets_touch_updated_at on public.timetable_presets;
create trigger timetable_presets_touch_updated_at
before update on public.timetable_presets
for each row execute function public.touch_updated_at();

create table if not exists public.profile_timetable_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preset_id uuid references public.timetable_presets(id) on delete set null,
  weekdays smallint[] not null,
  periods jsonb not null,
  updated_at timestamptz not null default now(),
  check (public.is_valid_timetable_weekdays(weekdays)),
  check (public.is_valid_timetable_periods(periods))
);

create index if not exists profile_timetable_settings_preset_idx
  on public.profile_timetable_settings(preset_id);

drop trigger if exists profile_timetable_settings_touch_updated_at on public.profile_timetable_settings;
create trigger profile_timetable_settings_touch_updated_at
before update on public.profile_timetable_settings
for each row execute function public.touch_updated_at();

alter table public.timetable_presets enable row level security;
alter table public.profile_timetable_settings enable row level security;

drop policy if exists timetable_presets_select_auth on public.timetable_presets;
create policy timetable_presets_select_auth on public.timetable_presets
  for select to authenticated
  using (true);

drop policy if exists timetable_presets_insert_admin on public.timetable_presets;
create policy timetable_presets_insert_admin on public.timetable_presets
  for insert to authenticated
  with check (public.is_admin(auth.uid()));

drop policy if exists timetable_presets_update_admin on public.timetable_presets;
create policy timetable_presets_update_admin on public.timetable_presets
  for update to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists timetable_presets_delete_admin on public.timetable_presets;
create policy timetable_presets_delete_admin on public.timetable_presets
  for delete to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists profile_timetable_settings_select_self on public.profile_timetable_settings;
create policy profile_timetable_settings_select_self on public.profile_timetable_settings
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists profile_timetable_settings_insert_self on public.profile_timetable_settings;
create policy profile_timetable_settings_insert_self on public.profile_timetable_settings
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists profile_timetable_settings_update_self on public.profile_timetable_settings;
create policy profile_timetable_settings_update_self on public.profile_timetable_settings
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists profile_timetable_settings_delete_self on public.profile_timetable_settings;
create policy profile_timetable_settings_delete_self on public.profile_timetable_settings
  for delete to authenticated
  using (auth.uid() = user_id);
