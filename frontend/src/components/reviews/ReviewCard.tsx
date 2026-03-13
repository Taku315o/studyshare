import Link from 'next/link';
import { Star } from 'lucide-react';
import { buildProfileHref } from '@/lib/profileHref';
import type { ReviewListItem } from '@/types/offering';

type ReviewCardProps = {
  review: ReviewListItem;
  currentUserId?: string | null;
};

function formatDate(date: string) {
  return new Date(date).toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ReviewCard({ review, currentUserId = null }: ReviewCardProps) {
  const authorHref = buildProfileHref(review.authorId, currentUserId);

  return (
    <article className="rounded-2xl border border-white/50 bg-white/70 p-5 shadow-sm backdrop-blur">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href={authorHref} className="shrink-0">
            {review.authorAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={review.authorAvatarUrl}
                alt={`${review.authorName}のアイコン`}
                className="h-9 w-9 rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                {review.authorName.slice(0, 1)}
              </div>
            )}
          </Link>
          <div>
            <Link href={authorHref} className="text-sm font-semibold text-slate-800 hover:underline">
              {review.authorName}
            </Link>
            <p className="text-xs text-slate-500">{formatDate(review.createdAt)}</p>
          </div>
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
