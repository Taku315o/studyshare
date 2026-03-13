'use client';

import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import type { OfferingFinderMode } from '@/lib/offerings/finder';
import type { TimetableSearchResult } from '@/types/timetable';

type OfferingSearchResultCardProps = {
  mode: OfferingFinderMode;
  result: TimetableSearchResult;
  detailHref: string;
  isSubmitting?: boolean;
  onRegister?: (result: TimetableSearchResult) => void | Promise<void>;
};

function registerButtonLabel(status: TimetableSearchResult['myStatus']) {
  if (status === 'enrolled' || status === 'planned') {
    return '追加済み';
  }
  return '登録';
}

export default function OfferingSearchResultCard({
  mode,
  result,
  detailHref,
  isSubmitting = false,
  onRegister,
}: OfferingSearchResultCardProps) {
  const isAlreadyAdded = result.myStatus === 'enrolled' || result.myStatus === 'planned';

  return (
    <article className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold text-slate-900">{result.courseTitle}</h2>
          {mode === 'timetable-add' && result.slotMatch ? (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">このコマに一致</span>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
          <span>{result.instructorName ?? '教員未設定'}</span>
          <span>{result.room ?? '教室未設定'}</span>
          <span>{result.enrollmentCount}人が登録</span>
        </div>

        <p className="mt-2 text-sm text-slate-500">{result.slotLabels.join(' / ') || '曜日・時限未設定'}</p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Link
          href={detailHref}
          className="inline-flex h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          詳細を見る
        </Link>

        {mode === 'timetable-add' ? (
          <button
            type="button"
            disabled={isAlreadyAdded || isSubmitting}
            onClick={() => void onRegister?.(result)}
            className="inline-flex h-11 min-w-[104px] items-center justify-center rounded-full bg-blue-500 px-6 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : registerButtonLabel(result.myStatus)}
          </button>
        ) : null}
      </div>
    </article>
  );
}
