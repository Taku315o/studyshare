import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
//course_offerings テーブルから授業のリストを取得し、各授業の情報を表示するページコンポーネント。授業名、教員名、開講タームなどをカード形式で表示し、各カードをクリックするとその授業の詳細ページに遷移する。
type OfferingListRow = {
  id: string;
  instructor: string | null;
  courses:
    | { name: string | null; course_code: string | null }
    | Array<{ name: string | null; course_code: string | null }>
    | null;
  terms: { year: number; season: string } | Array<{ year: number; season: string }> | null;
};

const SEASON_LABELS: Record<string, string> = {
  first_half: '前期',
  second_half: '後期',
};

export default async function OfferingsPage() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('course_offerings')
    .select(
      `
      id,
      instructor,
      courses:course_id(name, course_code),
      terms:term_id(year, season)
    `,
    )
    .order('created_at', { ascending: false })
    .limit(24);

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-white/50 bg-white/70 p-6 shadow-sm backdrop-blur">
        <h1 className="text-2xl font-bold text-slate-900">授業・口コミ</h1>
        <p className="mt-2 text-sm text-slate-600">授業を選択して、ノート・口コミ・質問・受講者情報を確認できます。</p>
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        {((data ?? []) as OfferingListRow[]).map((offering) => {
          {/* coursesとtermsは現状1対1の関係だが、将来的に複数対応する可能性があるため配列で受け取る */}
          const course = Array.isArray(offering.courses) ? offering.courses[0] : offering.courses;
          const term = Array.isArray(offering.terms) ? offering.terms[0] : offering.terms;
          const termLabel = term ? `${term.year} ${SEASON_LABELS[term.season] ?? term.season}` : '未設定';
          return (
            <Link
              key={offering.id}
              href={`/offerings/${offering.id}`}
              className="rounded-2xl border border-white/50 bg-white/70 p-4 shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
            >
              <p className="text-base font-semibold text-slate-900">{course?.name ?? '不明な授業'}</p>
              <p className="mt-1 text-sm text-slate-600">{offering.instructor ?? '教員未設定'}</p>
              <p className="mt-2 text-xs text-slate-500">{termLabel}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
