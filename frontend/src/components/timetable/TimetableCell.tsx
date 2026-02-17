'use client';

import { useState } from 'react';
import { Plus, Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type {
  TimetableColorToken,
  TimetableOfferingItem,
  TimetablePeriod,
  TimetableStatus,
  TimetableWeekday,
} from '@/types/timetable';

type TimetableCellProps = {
  dayOfWeek: TimetableWeekday;
  period: TimetablePeriod;
  item: TimetableOfferingItem | null;
  overlapCount: number;
  onOpenAdd: (dayOfWeek: TimetableWeekday, period: TimetablePeriod) => void;
  onOpenOverlaps?: () => void;
};

const COLOR_STYLES: Record<TimetableColorToken, string> = {
  sky: 'border-sky-200 bg-sky-50 text-sky-900',
  indigo: 'border-indigo-200 bg-indigo-50 text-indigo-900',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  amber: 'border-amber-200 bg-amber-50 text-amber-900',
  rose: 'border-rose-200 bg-rose-50 text-rose-900',
  teal: 'border-teal-200 bg-teal-50 text-teal-900',
};

const STATUS_STYLES: Record<TimetableStatus, { label: string; className: string }> = {
  enrolled: { label: '履修中', className: 'bg-blue-100 text-blue-700' },
  planned: { label: '予定', className: 'bg-amber-100 text-amber-700' },
  dropped: { label: '取消', className: 'bg-slate-200 text-slate-600' },
};

export default function TimetableCell({
  dayOfWeek,
  period,
  item,
  overlapCount,
  onOpenAdd,
  onOpenOverlaps,
}: TimetableCellProps) {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);

  const handleOpenAdd = () => {
    onOpenAdd(dayOfWeek, period);
  };

  if (!item) {
    return (
      <div className="relative h-full rounded-xl border border-dashed border-slate-300 bg-slate-50/70">
        <button
          type="button"
          onClick={handleOpenAdd}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onFocus={() => setIsHovered(true)}
          onBlur={() => setIsHovered(false)}
          className="flex h-full min-h-24 w-full flex-col items-center justify-center rounded-xl px-2 py-3 text-slate-500 transition hover:bg-slate-100"
          aria-label="空きコマ"
        >
          <Plus className="h-4 w-4" />
          <span className="mt-1 text-xs font-medium">{isHovered ? '＋ 授業を追加' : '空きコマ'}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <button
        type="button"
        onClick={() => router.push(`/offerings/${item.offeringId}`)}
        className={[
          'relative flex h-full min-h-24 w-full flex-col rounded-xl border p-3 text-left shadow-sm transition hover:-translate-y-0.5',
          item.status === 'dropped' ? 'opacity-60' : '',
          COLOR_STYLES[item.colorToken],
        ].join(' ')}
      >
        <Star className="absolute right-2 top-2 h-3.5 w-3.5 opacity-70" aria-label="お気に入り（準備中）" />
        <span className="line-clamp-2 pr-5 text-sm font-semibold">{item.courseTitle}</span>
        <span className="mt-1 line-clamp-1 text-xs">{item.instructorName}</span>
        <span className="mt-1 text-xs">{item.startTime}</span>
        <span
          className={[
            'mt-2 inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold',
            STATUS_STYLES[item.status].className,
          ].join(' ')}
        >
          {STATUS_STYLES[item.status].label}
        </span>
      </button>

      {overlapCount > 1 && onOpenOverlaps ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpenOverlaps();
          }}
          className="absolute right-2 top-2 rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-white"
          aria-label="重複している授業を表示"
        >
          +{overlapCount - 1}
        </button>
      ) : null}
    </div>
  );
}
