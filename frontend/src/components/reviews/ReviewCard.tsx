import { Star } from 'lucide-react';
import UserContactActions from '@/components/community/UserContactActions';
import type { ReviewListItem } from '@/types/offering';

type ReviewCardProps = {
  review: ReviewListItem;
  currentUserId: string | null;
};

function formatDate(date: string) {
  return new Date(date).toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ReviewCard({ review, currentUserId }: ReviewCardProps) {
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
      <div className="mt-4 border-t border-slate-200/80 pt-3">
        <UserContactActions
          targetUserId={review.authorId}
          targetDisplayName={review.authorName}
          currentUserId={currentUserId}
          allowDm={review.authorAllowDm}
          compact
          source="review"
        />
      </div>
    </article>
  );
}
