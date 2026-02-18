import { Star } from 'lucide-react';
import type { ReviewListItem } from '@/types/offering';

type ReviewCardProps = {
  review: ReviewListItem;
};

function formatDate(date: string) {
  return new Date(date).toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ReviewCard({ review }: ReviewCardProps) {
  return (
    <article className="rounded-2xl border border-white/50 bg-white/70 p-5 shadow-sm backdrop-blur">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800">{review.authorName}</p>
          <p className="text-xs text-slate-500">{formatDate(review.createdAt)}</p>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700">
          <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
          {review.rating.toFixed(1)}
        </div>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
        {review.comment ?? 'コメントなし'}
      </p>
    </article>
  );
}
