import { useEffect, useState } from 'react';
import { createSupabaseClient } from '@/lib/supabase/client';
import {
  DEFAULT_GLOBAL_TIMETABLE_CONFIG,
  loadEffectiveTimetableConfig,
} from '@/lib/timetable/config';
import { parseDateAtStartOfDay, resolveDefaultTerm, sortTermsForSelector } from '@/lib/timetable/terms';
import type {
  TimetableColorToken,
  TimetableConfig,
  TimetableStatus,
  TimetableTermOption,
  TimetableWeekday,
} from '@/types/timetable';

type ProfileQueryRow = {
  university_id: string | null;
};

type TermQueryRow = {
  id: string;
  academic_year: number;
  code: string;
  display_name: string;
  sort_key: number;
  start_date: string | null;
  end_date: string | null;
};

type TimetableRpcRow = {
  term_id: string;
  term_academic_year: number;
  term_code: string;
  term_display_name: string;
  term_sort_key: number;
  offering_id: string;
  course_title: string | null;
  instructor: string | null;
  status: string;
  created_at: string;
  day_of_week: number | null;
  period: number | null;
  start_time: string | null;
  room: string | null;
  is_unslotted: boolean | null;
};

export type TimetableEnrollmentEntry = {
  offeringId: string;
  termId: string;
  courseTitle: string;
  instructorName: string;
  colorToken: TimetableColorToken;
  createdAt: string;
  status: TimetableStatus;
  slots: Array<{
    dayOfWeek: TimetableWeekday;
    period: number;
    startTime: string;
  }>;
  isUnslotted: boolean;
  room: string | null;
};

type SupabaseLikeClient = ReturnType<typeof createSupabaseClient>;

type UseTimetableGridDataParams = {
  rawSelectedTermId: string | null;
  showDropped: boolean;
  supabase: SupabaseLikeClient;
};

type UseTimetableGridDataResult = {
  enrollmentEntries: TimetableEnrollmentEntry[];
  terms: TimetableTermOption[];
  timetableConfig: TimetableConfig;
  isLoading: boolean;
  errorMessage: string | null;
  resolvedTermId: string | null;
  updateEnrollmentStatusLocally: (offeringId: string, status: TimetableStatus) => void;
};

const COLOR_TOKENS: TimetableColorToken[] = ['sky', 'indigo', 'emerald', 'amber', 'rose', 'teal'];
const TIMETABLE_STATUSES: TimetableStatus[] = ['enrolled', 'planned', 'dropped'];

function isWeekdayValue(value: number | null): value is TimetableWeekday {
  return value !== null && value >= 1 && value <= 7;
}

function isStatus(value: string): value is TimetableStatus {
  return TIMETABLE_STATUSES.includes(value as TimetableStatus);
}

function resolveColorToken(offeringId: string): TimetableColorToken {
  let hash = 0;
  for (let index = 0; index < offeringId.length; index += 1) {
    hash = (hash * 31 + offeringId.charCodeAt(index)) | 0;
  }
  const normalized = Math.abs(hash) % COLOR_TOKENS.length;
  return COLOR_TOKENS[normalized];
}

function formatTime(value: string | null, fallback: string): string {
  if (!value) return fallback;
  const [hourRaw, minuteRaw] = value.split(':');
  const hour = Number(hourRaw);
  const minute = minuteRaw ?? '00';
  if (Number.isNaN(hour)) return fallback;
  return `${hour}:${minute}`;
}

function toTermOption(row: TermQueryRow): TimetableTermOption {
  return {
    id: row.id,
    academicYear: row.academic_year,
    code: row.code,
    displayName: row.display_name,
    sortKey: row.sort_key,
    startDate: parseDateAtStartOfDay(row.start_date),
    endDate: parseDateAtStartOfDay(row.end_date),
  };
}

function normalizeEnrollmentEntries(rows: TimetableRpcRow[], config: TimetableConfig) {
  const byOfferingId = new Map<string, TimetableEnrollmentEntry>();

  rows.forEach((row) => {
    if (!isStatus(row.status)) return;

    const existing = byOfferingId.get(row.offering_id);
    const entry =
      existing ??
      {
        offeringId: row.offering_id,
        termId: row.term_id,
        courseTitle: row.course_title ?? '不明な授業',
        instructorName: row.instructor ?? '教員未設定',
        colorToken: resolveColorToken(row.offering_id),
        createdAt: row.created_at,
        status: row.status,
        slots: [],
        isUnslotted: false,
        room: row.room ?? null,
      };

    if (isWeekdayValue(row.day_of_week) && row.period !== null && Number.isInteger(row.period) && row.period > 0) {
      const fallbackStartTime = config.periods.find((period) => period.period === row.period)?.startTime ?? '0:00';
      entry.slots.push({
        dayOfWeek: row.day_of_week,
        period: row.period,
        startTime: formatTime(row.start_time, fallbackStartTime),
      });
    } else if (row.is_unslotted || row.day_of_week === null || row.period === null) {
      entry.isUnslotted = true;
    }

    if (!entry.room && row.room) {
      entry.room = row.room;
    }

    byOfferingId.set(row.offering_id, entry);
  });

  return Array.from(byOfferingId.values());
}

export function useTimetableGridData({
  rawSelectedTermId,
  showDropped,
  supabase,
}: UseTimetableGridDataParams): UseTimetableGridDataResult {
  const [enrollmentEntries, setEnrollmentEntries] = useState<TimetableEnrollmentEntry[]>([]);
  const [terms, setTerms] = useState<TimetableTermOption[]>([]);
  const [timetableConfig, setTimetableConfig] = useState<TimetableConfig>(DEFAULT_GLOBAL_TIMETABLE_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resolvedTermId, setResolvedTermId] = useState<string | null>(rawSelectedTermId);

  useEffect(() => {
    let cancelled = false;

    const fetchTimetable = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          if (!cancelled) {
            setEnrollmentEntries([]);
            setTerms([]);
            setTimetableConfig(DEFAULT_GLOBAL_TIMETABLE_CONFIG);
            setResolvedTermId(null);
          }
          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('university_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        const profile = (profileData ?? null) as ProfileQueryRow | null;

        const configPromise = loadEffectiveTimetableConfig(supabase, user.id, profile?.university_id ?? null).catch((error) => {
          console.error('[TimetableGrid] 時間割設定の取得に失敗しました。デフォルトを適用します:', error);
          return { config: DEFAULT_GLOBAL_TIMETABLE_CONFIG };
        });

        const termsPromise = profile?.university_id
          ? supabase
              .from('terms')
              .select('id, academic_year, code, display_name, sort_key, start_date, end_date')
              .eq('university_id', profile.university_id)
          : Promise.resolve({ data: [] as TermQueryRow[], error: null });

        const [configResult, termsResult] = await Promise.all([configPromise, termsPromise]);

        if (termsResult.error) {
          throw termsResult.error;
        }

        const nextTerms = sortTermsForSelector(((termsResult.data ?? []) as TermQueryRow[]).map(toTermOption));
        const effectiveTerm = nextTerms.find((term) => term.id === rawSelectedTermId) ?? resolveDefaultTerm(nextTerms, new Date());

        if (!cancelled) {
          setTimetableConfig(configResult.config);
          setTerms(nextTerms);
          setResolvedTermId(effectiveTerm?.id ?? null);
        }

        if (!effectiveTerm) {
          if (!cancelled) {
            setEnrollmentEntries([]);
          }
          return;
        }

        const rpcClient = supabase as unknown as {
          rpc: (
            fn: 'list_my_timetable',
            args: {
              _term_id: string;
              _include_dropped: boolean;
            },
          ) => Promise<{ data: TimetableRpcRow[] | null; error: { message?: string } | null }>;
        };

        const { data, error } = await rpcClient.rpc('list_my_timetable', {
          _term_id: effectiveTerm.id,
          _include_dropped: showDropped,
        });

        if (error) {
          throw error;
        }

        if (!cancelled) {
          setEnrollmentEntries(normalizeEnrollmentEntries(data ?? [], configResult.config));
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setErrorMessage('時間割の取得に失敗しました。しばらくしてから再度お試しください。');
          setEnrollmentEntries([]);
          setTerms([]);
          setTimetableConfig(DEFAULT_GLOBAL_TIMETABLE_CONFIG);
          setResolvedTermId(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchTimetable();

    return () => {
      cancelled = true;
    };
  }, [rawSelectedTermId, showDropped, supabase]);

  return {
    enrollmentEntries,
    terms,
    timetableConfig,
    isLoading,
    errorMessage,
    resolvedTermId,
    updateEnrollmentStatusLocally: (offeringId, status) => {
      setEnrollmentEntries((current) =>
        current.map((entry) => (entry.offeringId === offeringId ? { ...entry, status } : entry)),
      );
    },
  };
}
