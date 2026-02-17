import TimetableGrid from '@/components/timetable/TimetableGrid';

export default function TimetablePage() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <section className="rounded-3xl border border-white/50 bg-white/75 p-6 shadow-sm backdrop-blur">
        <h1 className="text-2xl font-bold text-slate-900">時間割</h1>
        <p className="mt-2 text-sm text-slate-600">
          あなたの履修中・予定の授業を、Offering単位で週間時間割として確認できます。
        </p>
      </section>

      <TimetableGrid />
    </div>
  );
}
