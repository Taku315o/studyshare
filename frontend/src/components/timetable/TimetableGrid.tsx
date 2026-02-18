'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import TimetableCell from '@/components/timetable/TimetableCell';
import { createSupabaseClient } from '@/lib/supabase/client';
import type {
  TimetableCellModel,
  TimetableColorToken,
  TimetableGridViewModel,
  TimetableOfferingItem,
  TimetablePeriod,
  TimetableSearchModalState,
  TimetableStatus,
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
        offering_slots: Array<{ day_of_week: number | null; period: number | null; start_time: string | null }> | null;
      }
    | Array<{
        id: string;
        instructor: string | null;
        courses: { id: string; name: string } | Array<{ id: string; name: string }> | null;
        offering_slots: Array<{ day_of_week: number | null; period: number | null; start_time: string | null }> | null;
      }>
    | null;
};

const WEEKDAYS: Array<{ key: TimetableWeekday; label: string }> = [
  { key: 1, label: '月' },
  { key: 2, label: '火' },
  { key: 3, label: '水' },
  { key: 4, label: '木' },
  { key: 5, label: '金' },
];

const PERIODS: Array<{ key: TimetablePeriod; label: string; startTime: string }> = [
  { key: 1, label: '1限', startTime: '9:00' },
  { key: 2, label: '2限', startTime: '10:45' },
  { key: 3, label: '3限', startTime: '13:10' },
  { key: 4, label: '4限', startTime: '14:55' },
  { key: 5, label: '5限', startTime: '16:40' },
];

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

function isWeekday(value: number | null): value is TimetableWeekday {
  return value !== null && value >= 1 && value <= 5;
}

function isPeriod(value: number | null): value is TimetablePeriod {
  return value !== null && value >= 1 && value <= 5;
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

function buildViewModel(items: TimetableOfferingItem[]): TimetableGridViewModel {
  const buckets = new Map<string, TimetableOfferingItem[]>();

  WEEKDAYS.forEach((day) => {
    PERIODS.forEach((period) => {
      buckets.set(`${day.key}-${period.key}`, []);
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
  WEEKDAYS.forEach((day) => {
    PERIODS.forEach((period) => {
      const key = `${day.key}-${period.key}`;
      const bucket = buckets.get(key) ?? [];
      cells.push({
        dayOfWeek: day.key,
        period: period.key,
        items: bucket,
        primaryItem: bucket[0] ?? null,
      });
    });
  });

  return { cells };
}

function modalTitle(state: TimetableSearchModalState): string {
  if (!state.isOpen) return '';
  if (state.source === 'page-search') return 'Offering検索（準備中）';
  if (state.source === 'matching-cta') return 'マッチング機能（準備中）';
  return '授業追加（準備中）';
}

function modalDescription(state: TimetableSearchModalState): string {
  if (!state.isOpen) return '';
  if (state.source === 'page-search') return '検索機能は次のフェーズで実装予定です。';
  if (state.source === 'matching-cta') return '同じ授業の受講者検索は今後のアップデートで対応します。';
  const day = state.dayOfWeek ? WEEKDAYS.find((entry) => entry.key === state.dayOfWeek)?.label : null;
  return day && state.period
    ? `${day}曜 ${state.period}限への授業追加モーダルは準備中です。`
    : '空きコマへの授業追加モーダルは準備中です。';
}

export default function TimetableGrid() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseClient(), []);

  const [items, setItems] = useState<TimetableOfferingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDropped, setShowDropped] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchModalState, setSearchModalState] = useState<TimetableSearchModalState>({ isOpen: false });
  const [activeOverlapCell, setActiveOverlapCell] = useState<TimetableCellModel | null>(null);

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
          }
          return;
        }

        const statuses: TimetableStatus[] = showDropped ? ['enrolled', 'planned', 'dropped'] : ['enrolled', 'planned'];

        const { data, error } = await supabase
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

        if (error) {
          throw error;
        }

        const rows = (data ?? []) as EnrollmentQueryRow[];
        const nextItems: TimetableOfferingItem[] = [];

        rows.forEach((row) => {
          const status = row.status;
          if (!isStatus(status)) return;
          const offering = normalizeOne(row.offering);
          if (!offering) return;

          const course = normalizeOne(offering.courses);
          const slots = Array.isArray(offering.offering_slots) ? offering.offering_slots : [];

          slots.forEach((slot) => {
            if (!isWeekday(slot.day_of_week) || !isPeriod(slot.period)) return;

            const fallbackStartTime = PERIODS.find((period) => period.key === slot.period)?.startTime ?? '0:00';
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

        if (!cancelled) {
          setItems(nextItems);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setErrorMessage('時間割の取得に失敗しました。しばらくしてから再度お試しください。');
          setItems([]);
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
  }, [showDropped, supabase]);

  const viewModel = useMemo(() => buildViewModel(items), [items]);

  const cellLookup = useMemo(() => {
    const map = new Map<string, TimetableCellModel>();
    viewModel.cells.forEach((cell) => {
      map.set(`${cell.dayOfWeek}-${cell.period}`, cell);
    });
    return map;
  }, [viewModel]);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchModalState({
      isOpen: true,
      source: 'page-search',
      keyword: searchKeyword.trim() || undefined,
    });
  };

  const handleOpenAdd = (dayOfWeek: TimetableWeekday, period: TimetablePeriod) => {
    setSearchModalState({ isOpen: true, source: 'empty-cell', dayOfWeek, period });
  };

  const handleCloseModal = () => {
    setSearchModalState({ isOpen: false });
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
              placeholder="Offeringを検索（準備中）"
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

        <label className="inline-flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showDropped}
            onChange={(event) => setShowDropped(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-500"
          />
          取消を表示
        </label>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">時間割を読み込み中...</div>
      ) : null}

      {!isLoading && errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-sm text-rose-700">{errorMessage}</div>
      ) : null}

      {!isLoading && !errorMessage ? (
        <>
          {items.length === 0 ? (
            <div className="space-y-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <p className="text-sm text-slate-600">履修中または予定の授業がありません。空きコマから授業を追加できます。</p>
              <button
                type="button"
                onClick={() => setSearchModalState({ isOpen: true, source: 'empty-cell' })}
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
                  <th className="w-24 border-b border-slate-200 px-2 py-2 text-left font-semibold text-slate-500" />
                  {WEEKDAYS.map((day) => (
                    <th key={day.key} className="border-b border-slate-200 px-2 py-2 text-center font-semibold text-slate-600">
                      {day.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map((period) => (
                  <tr key={period.key}>
                    <td className="border-b border-slate-100 px-2 py-3 align-top text-slate-500">
                      <p className="text-sm font-semibold">{period.label}</p>
                      <p className="text-xs">{period.startTime}</p>
                    </td>
                    {WEEKDAYS.map((day) => {
                      const cell = cellLookup.get(`${day.key}-${period.key}`);
                      const target = cell ?? { dayOfWeek: day.key, period: period.key, primaryItem: null, items: [] };
                      return (
                        <td key={`${day.key}-${period.key}`} className="h-32 border-b border-slate-100 px-2 py-2 align-top">
                          <TimetableCell
                            dayOfWeek={target.dayOfWeek}
                            period={target.period}
                            item={target.primaryItem}
                            overlapCount={target.items.length}
                            onOpenAdd={handleOpenAdd}
                            onOpenOverlaps={() => setActiveOverlapCell(target)}
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
            {WEEKDAYS.map((day) => (
              <section key={day.key} className="space-y-2 rounded-2xl border border-slate-200 p-3">
                <h3 className="text-sm font-semibold text-slate-700">{day.label}曜日</h3>
                <div className="space-y-2">
                  {PERIODS.map((period) => {
                    const cell = cellLookup.get(`${day.key}-${period.key}`);
                    const target = cell ?? { dayOfWeek: day.key, period: period.key, primaryItem: null, items: [] };
                    return (
                      <div key={`${day.key}-${period.key}`} className="grid grid-cols-[54px_minmax(0,1fr)] items-stretch gap-2">
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
          onClick={() => setSearchModalState({ isOpen: true, source: 'matching-cta' })}
          className="mt-3 rounded-full bg-blue-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-400"
        >
          受講者を探す（準備中）
        </button>
      </section>

      {searchModalState.isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/70 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">{modalTitle(searchModalState)}</h3>
              <button
                type="button"
                onClick={handleCloseModal}
                className="rounded-full p-1 text-slate-500 hover:bg-slate-100"
                aria-label="モーダルを閉じる"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-slate-600">{modalDescription(searchModalState)}</p>
            {searchModalState.source === 'page-search' && searchModalState.keyword ? (
              <p className="mt-2 text-xs text-slate-500">入力キーワード: {searchModalState.keyword}</p>
            ) : null}
            <button
              type="button"
              onClick={handleCloseModal}
              className="mt-5 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              閉じる
            </button>
          </div>
        </div>
      ) : null}

      {activeOverlapCell ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/70 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                {WEEKDAYS.find((day) => day.key === activeOverlapCell.dayOfWeek)?.label}曜 {activeOverlapCell.period}限
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
