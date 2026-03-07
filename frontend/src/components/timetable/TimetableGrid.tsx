'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import TimetableCell from '@/components/timetable/TimetableCell';
import {
  buildTimetableAddHref,
  consumeTimetableReturnHighlight,
  consumeTimetableScrollPosition,
  persistTimetableScrollPosition,
} from '@/lib/timetable/add';
import {
  DEFAULT_GLOBAL_TIMETABLE_CONFIG,
  formatWeekdayLabel,
  loadEffectiveTimetableConfig,
} from '@/lib/timetable/config';
import { resolveCurrentTerm, formatSeasonLabel, parseDateAtStartOfDay, sortTermsDescending } from '@/lib/timetable/terms';
import { createSupabaseClient } from '@/lib/supabase/client';
import type {
  TimetableCellModel,
  TimetableColorToken,
  TimetableConfig,
  TimetableGridViewModel,
  TimetableOfferingItem,
  TimetableReturnHighlight,
  TimetableStatus,
  TimetableTermOption,
  TimetableWeekday,
} from '@/types/timetable';

type EnrollmentQueryRow = {
  created_at: string;
  status: string;
  offering:
    | {
        id: string;
        instructor: string | null;
        courses: { id: string; name: string } | Array<{ id: string; name: string }> | null;
        terms:
          | { id: string; year: number; season: string; start_date: string | null; end_date: string | null }
          | Array<{ id: string; year: number; season: string; start_date: string | null; end_date: string | null }>
          | null;
        offering_slots: Array<{ day_of_week: number | null; period: number | null; start_time: string | null }> | null;
      }
    | Array<{
        id: string;
        instructor: string | null;
        courses: { id: string; name: string } | Array<{ id: string; name: string }> | null;
        terms:
          | { id: string; year: number; season: string; start_date: string | null; end_date: string | null }
          | Array<{ id: string; year: number; season: string; start_date: string | null; end_date: string | null }>
          | null;
        offering_slots: Array<{ day_of_week: number | null; period: number | null; start_time: string | null }> | null;
      }>
    | null;
};

type ProfileQueryRow = {
  university_id: string | null;
};

type TermQueryRow = {
  id: string;
  year: number;
  season: string;
  start_date: string | null;
  end_date: string | null;
};

const STATUS_PRIORITY: Record<TimetableStatus, number> = {
  enrolled: 0,
  planned: 1,
  dropped: 2,
};

const COLOR_TOKENS: TimetableColorToken[] = ['sky', 'indigo', 'emerald', 'amber', 'rose', 'teal'];
const TIMETABLE_STATUSES: TimetableStatus[] = ['enrolled', 'planned', 'dropped'];

function normalizeOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

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

function buildViewModel(items: TimetableOfferingItem[], config: TimetableConfig): TimetableGridViewModel {
  const buckets = new Map<string, TimetableOfferingItem[]>();

  config.weekdays.forEach((day) => {
    config.periods.forEach((period) => {
      buckets.set(`${day}-${period.period}`, []);
    });
  });

  items.forEach((item) => {
    const key = `${item.dayOfWeek}-${item.period}`;
    const current = buckets.get(key);
    if (current) current.push(item);
  });

  buckets.forEach((bucket) => {
    bucket.sort((left, right) => {
      const statusDiff = STATUS_PRIORITY[left.status] - STATUS_PRIORITY[right.status];
      if (statusDiff !== 0) return statusDiff;
      return left.createdAt.localeCompare(right.createdAt);
    });
  });

  const cells: TimetableCellModel[] = [];
  config.weekdays.forEach((day) => {
    config.periods.forEach((period) => {
      const key = `${day}-${period.period}`;
      const bucket = buckets.get(key) ?? [];
      cells.push({
        dayOfWeek: day,
        period: period.period,
        items: bucket,
        primaryItem: bucket[0] ?? null,
      });
    });
  });

  return { cells };
}

function periodLabel(config: TimetableConfig, period: number | undefined) {
  if (!period) return '時限';
  return config.periods.find((entry) => entry.period === period)?.label ?? `${period}限`;
}

function toTermOption(row: TermQueryRow): TimetableTermOption {
  return {
    id: row.id,
    label: `${row.year} ${formatSeasonLabel(row.season)}`,
    year: row.year,
    season: row.season,
    startDate: parseDateAtStartOfDay(row.start_date),
    endDate: parseDateAtStartOfDay(row.end_date),
  };
}

export default function TimetableGrid() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createSupabaseClient(), []);
  const typedSupabase = supabase;

  const [items, setItems] = useState<TimetableOfferingItem[]>([]);
  const [terms, setTerms] = useState<TimetableTermOption[]>([]);
  const [timetableConfig, setTimetableConfig] = useState<TimetableConfig>(DEFAULT_GLOBAL_TIMETABLE_CONFIG);
  const [outOfConfigItems, setOutOfConfigItems] = useState<TimetableOfferingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDropped, setShowDropped] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [activeOverlapCell, setActiveOverlapCell] = useState<TimetableCellModel | null>(null);
  const [activeHighlight, setActiveHighlight] = useState<TimetableReturnHighlight | null>(null);

  const pendingScrollRef = useRef<number | null>(null);
  const pendingHighlightRef = useRef<TimetableReturnHighlight | null>(null);
  const hasAppliedReturnStateRef = useRef(false);
  const highlightTimerRef = useRef<number | null>(null);

  useEffect(() => {
    pendingScrollRef.current = consumeTimetableScrollPosition();
    pendingHighlightRef.current = consumeTimetableReturnHighlight();

    return () => {
      if (highlightTimerRef.current !== null) {
        window.clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

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
            setItems([]);
            setTerms([]);
            setOutOfConfigItems([]);
            setTimetableConfig(DEFAULT_GLOBAL_TIMETABLE_CONFIG);
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

        const configPromise = loadEffectiveTimetableConfig(typedSupabase, user.id, profile?.university_id ?? null).catch((error) => {
          console.error('[TimetableGrid] 時間割設定の取得に失敗しました。デフォルトを適用します:', error);
          return { config: DEFAULT_GLOBAL_TIMETABLE_CONFIG };
        });

        const termsPromise = profile?.university_id
          ? supabase
              .from('terms')
              .select('id, year, season, start_date, end_date')
              .eq('university_id', profile.university_id)
          : Promise.resolve({ data: [] as TermQueryRow[], error: null });

        const statuses: TimetableStatus[] = showDropped ? ['enrolled', 'planned', 'dropped'] : ['enrolled', 'planned'];

        const enrollmentsPromise = supabase
          .from('enrollments')
          .select(
            `
            created_at,
            status,
            offering:course_offerings (
              id,
              instructor,
              courses:course_id (
                id,
                name
              ),
              terms:term_id (
                id,
                year,
                season,
                start_date,
                end_date
              ),
              offering_slots (
                day_of_week,
                period,
                start_time
              )
            )
          `,
          )
          .eq('user_id', user.id)
          .in('status', statuses);

        const [configResult, termsResult, enrollmentsResult] = await Promise.all([
          configPromise,
          termsPromise,
          enrollmentsPromise,
        ]);

        if (termsResult.error) {
          throw termsResult.error;
        }

        if (enrollmentsResult.error) {
          throw enrollmentsResult.error;
        }

        const activeConfig = configResult.config;
        const rows = (enrollmentsResult.data ?? []) as EnrollmentQueryRow[];
        const nextItems: TimetableOfferingItem[] = [];
        const fallbackTermMap = new Map<string, TimetableTermOption>();

        rows.forEach((row) => {
          const status = row.status;
          if (!isStatus(status)) return;

          const offering = normalizeOne(row.offering);
          if (!offering) return;

          const course = normalizeOne(offering.courses);
          const term = normalizeOne(offering.terms);
          const slots = Array.isArray(offering.offering_slots) ? offering.offering_slots : [];

          if (term) {
            fallbackTermMap.set(
              term.id,
              toTermOption({
                id: term.id,
                year: term.year,
                season: term.season,
                start_date: term.start_date,
                end_date: term.end_date,
              }),
            );
          }

          slots.forEach((slot) => {
            if (!isWeekdayValue(slot.day_of_week) || slot.period === null || !Number.isInteger(slot.period) || slot.period < 1) return;

            const fallbackStartTime =
              activeConfig.periods.find((period) => period.period === slot.period)?.startTime ?? '0:00';
            nextItems.push({
              offeringId: offering.id,
              courseTitle: course?.name ?? '不明な授業',
              instructorName: offering.instructor ?? '教員未設定',
              startTime: formatTime(slot.start_time, fallbackStartTime),
              dayOfWeek: slot.day_of_week,
              period: slot.period,
              status,
              colorToken: resolveColorToken(offering.id),
              createdAt: row.created_at,
            });
          });
        });

        const availableSlots = new Set<string>();
        activeConfig.weekdays.forEach((weekday) => {
          activeConfig.periods.forEach((period) => {
            availableSlots.add(`${weekday}-${period.period}`);
          });
        });

        const uniqueOutOfConfigMap = new Map<string, TimetableOfferingItem>();
        nextItems.forEach((item) => {
          const key = `${item.dayOfWeek}-${item.period}`;
          if (availableSlots.has(key)) {
            return;
          }
          uniqueOutOfConfigMap.set(`${item.offeringId}-${item.dayOfWeek}-${item.period}`, item);
        });

        const termRows = ((termsResult.data ?? []) as TermQueryRow[]).map(toTermOption);
        const nextTerms = termRows.length > 0 ? sortTermsDescending(termRows) : sortTermsDescending(Array.from(fallbackTermMap.values()));

        if (!cancelled) {
          setTimetableConfig(activeConfig);
          setItems(nextItems);
          setTerms(nextTerms);
          setOutOfConfigItems(Array.from(uniqueOutOfConfigMap.values()));
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setErrorMessage('時間割の取得に失敗しました。しばらくしてから再度お試しください。');
          setItems([]);
          setTerms([]);
          setOutOfConfigItems([]);
          setTimetableConfig(DEFAULT_GLOBAL_TIMETABLE_CONFIG);
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
  }, [showDropped, supabase, typedSupabase]);

  useEffect(() => {
    if (isLoading || errorMessage || hasAppliedReturnStateRef.current) {
      return;
    }

    hasAppliedReturnStateRef.current = true;

    if (pendingScrollRef.current !== null && typeof window !== 'undefined') {
      const top = pendingScrollRef.current;
      window.requestAnimationFrame(() => {
        window.scrollTo({ top, behavior: 'auto' });
      });
    }

    if (pendingHighlightRef.current && typeof window !== 'undefined') {
      setActiveHighlight(pendingHighlightRef.current);
      highlightTimerRef.current = window.setTimeout(() => {
        setActiveHighlight(null);
      }, 2600);
    }
  }, [errorMessage, isLoading]);

  const currentTerm = useMemo(() => resolveCurrentTerm(terms, new Date()), [terms]);
  const viewModel = useMemo(() => buildViewModel(items, timetableConfig), [items, timetableConfig]);

  const cellLookup = useMemo(() => {
    const map = new Map<string, TimetableCellModel>();
    viewModel.cells.forEach((cell) => {
      map.set(`${cell.dayOfWeek}-${cell.period}`, cell);
    });
    return map;
  }, [viewModel]);

  const navigateToAdd = (args: {
    dayOfWeek?: TimetableWeekday | null;
    period?: number | null;
    query?: string | null;
  }) => {
    persistTimetableScrollPosition();
    router.push(
      buildTimetableAddHref({
        termId: currentTerm?.id ?? terms[0]?.id ?? null,
        dayOfWeek: args.dayOfWeek ?? null,
        period: args.period ?? null,
        query: args.query ?? null,
        returnTo: pathname ?? '/timetable',
      }),
    );
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigateToAdd({ query: searchKeyword });
  };

  const handleOpenAdd = (dayOfWeek: TimetableWeekday, period: number) => {
    navigateToAdd({ dayOfWeek, period });
  };

  return (
    <div className="space-y-5 rounded-3xl border border-white/60 bg-white/80 p-5 shadow-sm backdrop-blur">
      <div className="space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 sm:flex-row">
          <label className="flex h-11 flex-1 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              placeholder="授業名または教員名で検索"
              className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            className="h-11 rounded-full bg-blue-500 px-6 text-sm font-semibold text-white transition hover:bg-blue-400"
          >
            検索
          </button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={showDropped}
              onChange={(event) => setShowDropped(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-500"
            />
            取消を表示
          </label>

          <p className="text-xs text-slate-500">
            追加候補の初期表示: {currentTerm?.label ?? '学期未設定'} / {terms.length > 0 ? '大学の学期あり' : '学期データ未設定'}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">時間割を読み込み中...</div>
      ) : null}

      {!isLoading && errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-sm text-rose-700">{errorMessage}</div>
      ) : null}

      {!isLoading && !errorMessage ? (
        <>
          {outOfConfigItems.length > 0 ? (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">設定外の授業が {outOfConfigItems.length} 件あります。設定を見直してください。</p>
              <ul className="mt-2 space-y-1 text-xs">
                {outOfConfigItems.slice(0, 5).map((item) => {
                  const isHighlighted =
                    activeHighlight?.outOfConfig &&
                    activeHighlight.offeringId === item.offeringId &&
                    activeHighlight.dayOfWeek === item.dayOfWeek &&
                    activeHighlight.period === item.period;

                  return (
                    <li
                      key={`${item.offeringId}-${item.dayOfWeek}-${item.period}`}
                      className={isHighlighted ? 'rounded-md bg-white/80 px-2 py-1 font-semibold text-amber-950' : undefined}
                    >
                      {item.courseTitle} / {formatWeekdayLabel(item.dayOfWeek)}曜 {periodLabel(timetableConfig, item.period)}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {items.length === 0 ? (
            <div className="space-y-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <p className="text-sm text-slate-600">履修中または予定の授業がありません。空きコマから授業を追加できます。</p>
              <button
                type="button"
                onClick={() => navigateToAdd({})}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              >
                ＋ 授業を追加
              </button>
            </div>
          ) : null}

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[860px] table-fixed border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="w-28 border-b border-slate-200 px-2 py-2 text-left font-semibold text-slate-500" />
                  {timetableConfig.weekdays.map((day) => (
                    <th key={day} className="border-b border-slate-200 px-2 py-2 text-center font-semibold text-slate-600">
                      {formatWeekdayLabel(day)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timetableConfig.periods.map((period) => (
                  <tr key={period.period}>
                    <td className="border-b border-slate-100 px-2 py-3 align-top text-slate-500">
                      <p className="text-sm font-semibold">{period.label}</p>
                      <p className="text-xs">{period.startTime}</p>
                    </td>
                    {timetableConfig.weekdays.map((day) => {
                      const cell = cellLookup.get(`${day}-${period.period}`);
                      const target = cell ?? { dayOfWeek: day, period: period.period, primaryItem: null, items: [] };
                      const isHighlighted =
                        activeHighlight?.outOfConfig !== true &&
                        activeHighlight?.dayOfWeek === target.dayOfWeek &&
                        activeHighlight?.period === target.period;

                      return (
                        <td key={`${day}-${period.period}`} className="h-32 border-b border-slate-100 px-2 py-2 align-top">
                          <TimetableCell
                            dayOfWeek={target.dayOfWeek}
                            period={target.period}
                            item={target.primaryItem}
                            overlapCount={target.items.length}
                            onOpenAdd={handleOpenAdd}
                            onOpenOverlaps={() => setActiveOverlapCell(target)}
                            isHighlighted={Boolean(isHighlighted)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-4 md:hidden">
            {timetableConfig.weekdays.map((day) => (
              <section key={day} className="space-y-2 rounded-2xl border border-slate-200 p-3">
                <h3 className="text-sm font-semibold text-slate-700">{formatWeekdayLabel(day)}曜日</h3>
                <div className="space-y-2">
                  {timetableConfig.periods.map((period) => {
                    const cell = cellLookup.get(`${day}-${period.period}`);
                    const target = cell ?? { dayOfWeek: day, period: period.period, primaryItem: null, items: [] };
                    const isHighlighted =
                      activeHighlight?.outOfConfig !== true &&
                      activeHighlight?.dayOfWeek === target.dayOfWeek &&
                      activeHighlight?.period === target.period;

                    return (
                      <div key={`${day}-${period.period}`} className="grid grid-cols-[72px_minmax(0,1fr)] items-stretch gap-2">
                        <div className="rounded-lg bg-slate-100 px-2 py-2 text-center text-xs text-slate-600">
                          <p className="font-semibold">{period.label}</p>
                          <p>{period.startTime}</p>
                        </div>
                        <TimetableCell
                          dayOfWeek={target.dayOfWeek}
                          period={target.period}
                          item={target.primaryItem}
                          overlapCount={target.items.length}
                          onOpenAdd={handleOpenAdd}
                          onOpenOverlaps={() => setActiveOverlapCell(target)}
                          isHighlighted={Boolean(isHighlighted)}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </>
      ) : null}

      <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
        <p className="text-sm text-blue-800">同じ授業を受講している人を探して、一緒に勉強しませんか？</p>
        <button
          type="button"
          onClick={() => router.push('/community')}
          className="mt-3 rounded-full bg-blue-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-400"
        >
          受講者を探す
        </button>
      </section>

      {activeOverlapCell ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/70 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                {formatWeekdayLabel(activeOverlapCell.dayOfWeek)}曜 {periodLabel(timetableConfig, activeOverlapCell.period)}
              </h3>
              <button
                type="button"
                onClick={() => setActiveOverlapCell(null)}
                className="rounded-full p-1 text-slate-500 hover:bg-slate-100"
                aria-label="重複モーダルを閉じる"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              {activeOverlapCell.items.map((item) => (
                <button
                  key={`${item.offeringId}-${item.createdAt}`}
                  type="button"
                  onClick={() => {
                    setActiveOverlapCell(null);
                    router.push(`/offerings/${item.offeringId}`);
                  }}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
                >
                  <span>
                    <p className="text-sm font-semibold text-slate-900">{item.courseTitle}</p>
                    <p className="text-xs text-slate-600">{item.instructorName}</p>
                  </span>
                  <span className="text-xs text-slate-500">{item.startTime}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
