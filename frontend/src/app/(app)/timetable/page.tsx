import Link from 'next/link';
import TimetableGrid from '@/components/timetable/TimetableGrid';

export default function TimetablePage() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <section className="rounded-3xl border border-white/50 bg-white/75 p-6 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">時間割</h1>
            <p className="mt-2 text-sm text-slate-600">
              あなたの履修中・予定の授業を、Offering単位で週間時間割として確認できます。
            </p>
          </div>
          <Link
            href="/me?modal=timetable-settings&from=timetable"
            className="inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            時間・曜日を変更
          </Link>
        </div>
      </section>

      <TimetableGrid />
    </div>
  );
}
