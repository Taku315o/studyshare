'use client';

import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import type { QuestionListItem } from '@/types/offering';

type QuestionCardProps = {
  offeringId: string;
  question: QuestionListItem;
};

function formatDate(date: string) {
  return new Date(date).toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function QuestionCard({ offeringId, question }: QuestionCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
      <Link
        href={`/offerings/${offeringId}/questions/${question.id}`}
        className="text-base font-semibold text-slate-900 hover:underline"
      >
        {question.title}
      </Link>
      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{question.body}</p>

      <div className="mt-2 flex items-center gap-2">
        <Link href={`/profile/${question.authorId}`} className="shrink-0">
          {question.authorAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={question.authorAvatarUrl}
              alt={`${question.authorName}のアイコン`}
              className="h-6 w-6 rounded-full border border-slate-200 object-cover"
            />
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              {question.authorName.slice(0, 1)}
            </div>
          )}
        </Link>
        <p className="text-xs text-slate-500">
          <Link href={`/profile/${question.authorId}`} className="hover:underline">
            {question.authorName}
          </Link>
          {' / '}
          {formatDate(question.createdAt)}
        </p>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1">
          <MessageCircle className="h-4 w-4 text-slate-500" />
          {question.answersCount}
        </span>
        <Link
          href={`/offerings/${offeringId}/questions/${question.id}`}
          className="font-semibold text-blue-600 hover:text-blue-500"
        >
          回答する
        </Link>
      </div>
    </article>
  );
}
