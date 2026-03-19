import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { createSupabaseClient } from '@/lib/supabase/client';
import type { Database } from '@/types/supabase';
import type { TimetableConfig, TimetablePeriodConfig, TimetableWeekday } from '@/types/timetable';

type TypedSupabaseClient = ReturnType<typeof createSupabaseClient>;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const DB_PERIOD_SCHEMA = z.object({
  period: z.number().int().min(1).max(30),
  label: z.string().trim().min(1).max(32),
  start_time: z.string().regex(TIME_PATTERN),
  end_time: z.string().regex(TIME_PATTERN),
});

const WEEKDAY_SCHEMA = z.number().int().min(1).max(7);

const CONFIG_SCHEMA = z.object({
  weekdays: z.array(WEEKDAY_SCHEMA).min(1).max(7),
  periods: z.array(DB_PERIOD_SCHEMA).min(1).max(30),
});

export const timetableConfigSchema = z.object({
  weekdays: z.array(WEEKDAY_SCHEMA).min(1).max(7),
  periods: z
    .array(
      z.object({
        period: z.number().int().min(1).max(30),
        label: z.string().trim().min(1).max(32),
        startTime: z.string().regex(TIME_PATTERN),
        endTime: z.string().regex(TIME_PATTERN),
      }),
    )
    .min(1)
    .max(30),
});

export const WEEKDAY_LABELS: Record<TimetableWeekday, string> = {
  1: '月',
  2: '火',
  3: '水',
  4: '木',
  5: '金',
  6: '土',
  7: '日',
};

export const DEFAULT_TIMETABLE_PERIODS: TimetablePeriodConfig[] = [
  { period: 1, label: '1限', startTime: '09:00', endTime: '10:40' },
  { period: 2, label: '2限', startTime: '10:45', endTime: '12:25' },
  { period: 3, label: '3限', startTime: '13:10', endTime: '14:50' },
  { period: 4, label: '4限', startTime: '14:55', endTime: '16:35' },
  { period: 5, label: '5限', startTime: '16:40', endTime: '18:20' },
  { period: 6, label: '6限', startTime: '18:25', endTime: '20:05' },
  { period: 7, label: '7限', startTime: '20:10', endTime: '21:50' },
];

export const DEFAULT_GLOBAL_TIMETABLE_CONFIG: TimetableConfig = {
  weekdays: [1, 2, 3, 4, 5],
  periods: DEFAULT_TIMETABLE_PERIODS,
};

type PresetRow = Pick<
  Database['public']['Tables']['timetable_presets']['Row'],
  'id' | 'weekdays' | 'periods'
>;

type UserSettingsRow = Pick<
  Database['public']['Tables']['profile_timetable_settings']['Row'],
  'preset_id' | 'weekdays' | 'periods'
>;

export type ResolvedTimetablePreset = {
  presetId: string | null;
  config: TimetableConfig;
  source: 'user' | 'university' | 'global';
};

function sortUniqueWeekdays(values: number[]): TimetableWeekday[] {
  const unique = Array.from(new Set(values)).sort((left, right) => left - right);
  return unique.filter((value): value is TimetableWeekday => value >= 1 && value <= 7);
}

function sortPeriods(values: TimetablePeriodConfig[]): TimetablePeriodConfig[] {
  const unique = new Map<number, TimetablePeriodConfig>();
  values.forEach((period) => {
    unique.set(period.period, period);
  });
  return Array.from(unique.values()).sort((left, right) => left.period - right.period);
}

function normalizePeriods(values: TimetablePeriodConfig[]): TimetablePeriodConfig[] {
  return sortPeriods(values);
}

function fromDbRow(weekdays: number[] | null, periods: unknown): TimetableConfig {
  const parsed = CONFIG_SCHEMA.safeParse({
    weekdays: weekdays ?? [],
    periods,
  });

  if (!parsed.success) {
    return DEFAULT_GLOBAL_TIMETABLE_CONFIG;
  }

  return {
    weekdays: sortUniqueWeekdays(parsed.data.weekdays),
    periods: normalizePeriods(
      parsed.data.periods.map((period) => ({
        period: period.period,
        label: period.label,
        startTime: period.start_time,
        endTime: period.end_time,
      })),
    ),
  };
}

function toDbPeriods(periods: TimetablePeriodConfig[]) {
  return periods.map((period) => ({
    period: period.period,
    label: period.label,
    start_time: period.startTime,
    end_time: period.endTime,
  }));
}

export function formatWeekdayLabel(weekday: number): string {
  return WEEKDAY_LABELS[weekday as TimetableWeekday] ?? `(${weekday})`;
}

export function formatWeekdayList(weekdays: number[]): string {
  return weekdays.map((weekday) => formatWeekdayLabel(weekday)).join('・');
}

export async function loadUniversityDefaultPreset(
  supabase: TypedSupabaseClient,
  universityId: string | null,
): Promise<ResolvedTimetablePreset> {
  if (universityId) {
    const { data, error } = await supabase
      .from('timetable_presets')
      .select('id, weekdays, periods')
      .eq('university_id', universityId)
      .eq('name', 'default')
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      const row = data as PresetRow;
      return {
        presetId: row.id,
        config: fromDbRow(row.weekdays, row.periods),
        source: 'university',
      };
    }
  }

  const { data: globalData, error: globalError } = await supabase
    .from('timetable_presets')
    .select('id, weekdays, periods')
    .is('university_id', null)
    .eq('name', 'default')
    .eq('is_active', true)
    .maybeSingle();

  if (globalError) {
    throw globalError;
  }

  if (globalData) {
    const row = globalData as PresetRow;
    return {
      presetId: row.id,
      config: fromDbRow(row.weekdays, row.periods),
      source: 'global',
    };
  }

  return {
    presetId: null,
    config: DEFAULT_GLOBAL_TIMETABLE_CONFIG,
    source: 'global',
  };
}

export async function loadEffectiveTimetableConfig(
  supabase: TypedSupabaseClient,
  userId: string,
  universityId: string | null,
): Promise<ResolvedTimetablePreset> {
  const { data, error } = await supabase
    .from('profile_timetable_settings')
    .select('preset_id, weekdays, periods')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    const row = data as UserSettingsRow;
    return {
      presetId: row.preset_id,
      config: fromDbRow(row.weekdays, row.periods),
      source: 'user',
    };
  }

  return loadUniversityDefaultPreset(supabase, universityId);
}

export async function upsertUserTimetableSettings(
  supabase: TypedSupabaseClient,
  args: {
    userId: string;
    presetId: string | null;
    config: TimetableConfig;
  },
) {
  const validation = timetableConfigSchema.safeParse(args.config);
  if (!validation.success) {
    throw new Error('時間割設定の形式が不正です');
  }

  const normalizedConfig: TimetableConfig = {
    weekdays: sortUniqueWeekdays(validation.data.weekdays),
    periods: normalizePeriods(validation.data.periods),
  };

  const writer = supabase as unknown as SupabaseClient<Database>;

  const { error } = await writer.from('profile_timetable_settings').upsert(
    {
      user_id: args.userId,
      preset_id: args.presetId,
      weekdays: normalizedConfig.weekdays,
      periods: toDbPeriods(normalizedConfig.periods),
    },
    { onConflict: 'user_id' },
  );

  if (error) {
    throw error;
  }

  return normalizedConfig;
}
