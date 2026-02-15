import { Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import type { Review } from '@/lib/mock/homeMock';

export type NewReviewsProps = {
  reviews: Review[];
};

export default function NewReviews({ reviews }: NewReviewsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>新着の口コミ</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {reviews.map((review) => (
          <article key={review.id} className="border-b border-slate-100 pb-4 last:border-none last:pb-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800">{review.userName}</p>
              <p className="text-xs text-slate-400">{review.createdAt}</p>
            </div>
            <p className="mt-1 text-xs text-slate-500">{review.courseTitle}</p>

            <div className="mt-2 flex items-center gap-1 text-amber-500">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={`${review.id}-${star}`} className="h-3.5 w-3.5" fill="currentColor" />
              ))}
              <span className="ml-1 text-xs font-semibold text-slate-700">{review.rating.toFixed(1)}</span>
            </div>

            <p className="mt-2 line-clamp-2 text-sm text-slate-700">{review.text}</p>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}
