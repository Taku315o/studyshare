import { Star } from 'lucide-react';
import type { MeReviewItemViewModel } from '@/types/me';

type MyReviewsListProps = {
  reviews: MeReviewItemViewModel[];
  isLoading: boolean;
};

function formatDate(date: string) {
  return new Date(date).toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MyReviewsList({ reviews, isLoading }: MyReviewsListProps) {
  if (isLoading) {
    return (
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={`my-review-skeleton-${index}`} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="h-5 w-28 rounded-full bg-slate-200" />
            <div className="mt-3 h-3 w-full rounded-full bg-slate-200" />
            <div className="mt-4 h-3 w-1/2 rounded-full bg-slate-200" />
          </div>
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
        まだ口コミを投稿していません。
      </p>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {reviews.map((review) => (
        <article key={review.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="line-clamp-1 text-sm font-semibold text-slate-800">{review.offeringTitle}</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
              <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
              {review.rating.toFixed(1)}
            </span>
          </div>
          <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm text-slate-600">
            {review.comment ?? 'コメントなし'}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{review.instructorName}</span>
            <span>{formatDate(review.createdAt)}</span>
          </div>
        </article>
      ))}
    </div>
  );
}
