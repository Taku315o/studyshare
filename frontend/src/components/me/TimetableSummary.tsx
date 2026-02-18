import Link from 'next/link';
import type { MeTimetableSummaryViewModel } from '@/types/me';

type TimetableSummaryProps = {
  summary: MeTimetableSummaryViewModel | null;
  isLoading: boolean;
};

function formatClassLabel(period: number | null, startTime: string | null) {
  if (period !== null && startTime) return `${period}限 (${startTime})`;
  if (period !== null) return `${period}限`;
  if (startTime) return startTime;
  return '時間未設定';
}

export default function TimetableSummary({ summary, isLoading }: TimetableSummaryProps) {
  return (
    <section className="rounded-3xl border border-white/50 bg-white/75 p-6 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">時間割サマリ</h2>
          <p className="mt-1 text-sm text-slate-600">履修状況と今日の授業を確認できます。</p>
        </div>
        <Link
          href="/timetable"
          className="inline-flex items-center rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400"
        >
          時間割を見る
        </Link>
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-3">
          <div className="h-4 w-40 rounded-full bg-slate-200" />
          <div className="h-14 w-full rounded-xl bg-slate-200" />
        </div>
      ) : (
        <>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">対象学期: {summary?.termLabel ?? '未設定'}</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              今学期履修数: {summary?.currentTermEnrollmentCount ?? 0} 件
            </p>
          </div>

          <div className="mt-4">
            <h3 className="text-sm font-semibold text-slate-800">今日の授業</h3>
            {summary && summary.todayClasses.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {summary.todayClasses.map((item) => (
                  <li
                    key={`${item.offeringId}-${item.period ?? 'na'}-${item.startTime ?? 'na'}`}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-slate-900">{item.courseTitle}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      {item.instructorName} / {formatClassLabel(item.period, item.startTime)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                今日の授業はありません。
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
