import Link from 'next/link';
import type { TimetableEnrollmentEntry } from '@/components/timetable/useTimetableGridData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatWeekdayLabel } from '@/lib/timetable/config';
import type { TimetableColorToken, TimetableConfig, TimetableStatus } from '@/types/timetable';

export type WeeklyTimetableProps = {
  timetableConfig: TimetableConfig;
  enrollmentEntries: TimetableEnrollmentEntry[];
  termLabel: string | null;
  isLoading: boolean;
  errorMessage: string | null;
};

type HomeTimetableCellItem = {
  offeringId: string;
  courseTitle: string;
  instructorName: string;
  startTime: string;
  endTime: string;
  colorToken: TimetableColorToken;
  status: TimetableStatus;
  createdAt: string;
};

const STATUS_PRIORITY: Record<TimetableStatus, number> = {
  enrolled: 0,
  planned: 1,
  dropped: 2,
};

const colorStyles: Record<TimetableColorToken, string> = {
  sky: 'border-sky-200 bg-sky-50 text-sky-900',
  indigo: 'border-indigo-200 bg-indigo-50 text-indigo-900',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  amber: 'border-amber-200 bg-amber-50 text-amber-900',
  rose: 'border-rose-200 bg-rose-50 text-rose-900',
  teal: 'border-teal-200 bg-teal-50 text-teal-900',
};

function buildCellKey(dayOfWeek: number, period: number) {
  return `${dayOfWeek}-${period}`;
}

function resolveHiddenOfferingCount(entries: TimetableEnrollmentEntry[], config: TimetableConfig) {
  const visibleDaySet = new Set(config.weekdays);
  const visiblePeriodSet = new Set(config.periods.map((period) => period.period));
  const hiddenOfferingIds = new Set<string>();

  entries.forEach((entry) => {
    if (entry.isUnslotted) {
      hiddenOfferingIds.add(entry.offeringId);
      return;
    }

    const hasOutOfConfigSlot = entry.slots.some(
      (slot) => !visibleDaySet.has(slot.dayOfWeek) || !visiblePeriodSet.has(slot.period),
    );

    if (hasOutOfConfigSlot) {
      hiddenOfferingIds.add(entry.offeringId);
    }
  });

  return hiddenOfferingIds.size;
}

function buildVisibleCellMap(entries: TimetableEnrollmentEntry[], config: TimetableConfig) {
  const visibleDaySet = new Set(config.weekdays);
  const visiblePeriodSet = new Set(config.periods.map((period) => period.period));
  const cellMap = new Map<string, HomeTimetableCellItem[]>();

  entries.forEach((entry) => {
    entry.slots.forEach((slot) => {
      if (!visibleDaySet.has(slot.dayOfWeek) || !visiblePeriodSet.has(slot.period)) {
        return;
      }

      const periodConfig = config.periods.find((period) => period.period === slot.period);
      if (!periodConfig) {
        return;
      }

      const key = buildCellKey(slot.dayOfWeek, slot.period);
      const items = cellMap.get(key) ?? [];
      items.push({
        offeringId: entry.offeringId,
        courseTitle: entry.courseTitle,
        instructorName: entry.instructorName,
        startTime: slot.startTime,
        endTime: periodConfig.endTime,
        colorToken: entry.colorToken,
        status: entry.status,
        createdAt: entry.createdAt,
      });
      cellMap.set(key, items);
    });
  });

  cellMap.forEach((items) => {
    items.sort((left, right) => {
      const statusDiff = STATUS_PRIORITY[left.status] - STATUS_PRIORITY[right.status];
      if (statusDiff !== 0) {
        return statusDiff;
      }

      return left.createdAt.localeCompare(right.createdAt);
    });
  });

  return cellMap;
}

export default function WeeklyTimetable({
  timetableConfig,
  enrollmentEntries,
  termLabel,
  isLoading,
  errorMessage,
}: WeeklyTimetableProps) {
  const cellMap = buildVisibleCellMap(enrollmentEntries, timetableConfig);
  const hiddenOfferingCount = resolveHiddenOfferingCount(enrollmentEntries, timetableConfig);
  const hasVisibleEntries = Array.from(cellMap.values()).some((items) => items.length > 0);
  const emptyMessage = termLabel
    ? '表示中の学期に、ホームで表示できる授業はまだありません。'
    : '表示できる学期がまだありません。';

  return (
    <Card>
      <CardHeader className="flex-wrap gap-3">
        <div>
          <CardTitle>今週の時間割</CardTitle>
          <p className="mt-1 text-sm text-slate-500">{termLabel ? `表示中: ${termLabel}` : '表示中の学期: 未設定'}</p>
        </div>
        <Link
          href="/timetable"
          className="inline-flex items-center rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400"
        >
          時間割を見る
        </Link>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">時間割を読み込み中...</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="h-24 rounded-2xl bg-slate-100" />
              <div className="h-24 rounded-2xl bg-slate-100" />
              <div className="h-24 rounded-2xl bg-slate-100" />
            </div>
          </div>
        ) : errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : !hasVisibleEntries ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
            <p className="text-sm text-slate-600">{emptyMessage}</p>
            <Link
              href="/timetable"
              className="mt-4 inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              時間割で確認する
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] table-fixed border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="w-24 border-b border-slate-200 px-2 py-2 text-left font-semibold text-slate-500" />
                  {timetableConfig.weekdays.map((day) => (
                    <th
                      key={day}
                      className="border-b border-slate-200 px-2 py-2 text-center font-semibold text-slate-600"
                    >
                      {formatWeekdayLabel(day)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timetableConfig.periods.map((period) => (
                  <tr key={period.period}>
                    <td className="border-b border-slate-100 px-2 py-3 align-top text-slate-500">
                      <p className="font-medium text-slate-700">{period.label}</p>
                      <p className="mt-1 text-xs">{period.startTime}</p>
                    </td>
                    {timetableConfig.weekdays.map((day) => {
                      const items = cellMap.get(buildCellKey(day, period.period)) ?? [];
                      const primaryItem = items[0] ?? null;

                      return (
                        <td key={`${day}-${period.period}`} className="h-28 border-b border-slate-100 px-2 py-2 align-top">
                          {primaryItem ? (
                            <div className={['rounded-xl border p-2.5 shadow-sm', colorStyles[primaryItem.colorToken]].join(' ')}>
                              <div className="flex items-start justify-between gap-2">
                                <p className="line-clamp-2 text-sm font-semibold">{primaryItem.courseTitle}</p>
                                {items.length > 1 ? (
                                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold">
                                    +{items.length - 1}
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 line-clamp-1 text-xs">{primaryItem.instructorName}</p>
                              <p className="mt-1 text-xs opacity-80">
                                {primaryItem.startTime} - {primaryItem.endTime}
                              </p>
                            </div>
                          ) : (
                            <div className="h-full rounded-xl border border-dashed border-slate-200 bg-slate-50/60" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && hiddenOfferingCount > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-sm text-slate-600">時間未設定/設定外の授業 {hiddenOfferingCount} 件</p>
            <Link href="/timetable" className="text-sm font-semibold text-blue-600 hover:text-blue-500">
              時間割で確認
            </Link>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
