import Link from 'next/link';
import { Bookmark, Heart } from 'lucide-react';
import type { MeSavedNoteItemViewModel } from '@/types/me';

type MySavedNotesListProps = {
  savedNotes: MeSavedNoteItemViewModel[];
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

export default function MySavedNotesList({ savedNotes, isLoading }: MySavedNotesListProps) {
  if (isLoading) {
    return (
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={`my-saved-skeleton-${index}`} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="h-5 w-2/3 rounded-full bg-slate-200" />
            <div className="mt-2 h-3 w-full rounded-full bg-slate-200" />
            <div className="mt-4 h-3 w-1/2 rounded-full bg-slate-200" />
          </div>
        ))}
      </div>
    );
  }

  if (savedNotes.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
        いいね・ブックマークしたノートはありません。
      </p>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {savedNotes.map((note) => (
        <Link key={note.id} href={`/offerings/${note.offeringId}?tab=notes`}>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:bg-blue-50/30">
            <h3 className="line-clamp-1 text-lg font-semibold text-slate-900">{note.title}</h3>
            <p className="mt-2 line-clamp-3 text-sm text-slate-600">{note.body ?? '本文なし'}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-slate-100 px-2.5 py-1">{note.offeringTitle}</span>
              <span>{note.instructorName}</span>
              <span>{note.authorName}</span>
              <span>{formatDate(note.createdAt)}</span>
            </div>
            <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-3">
              {note.isLikedByMe ? (
                <span className="inline-flex items-center gap-1 text-xs text-rose-500">
                  <Heart className="h-3.5 w-3.5 fill-rose-500" />
                  いいね済み
                </span>
              ) : null}
              {note.isBookmarkedByMe ? (
                <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                  <Bookmark className="h-3.5 w-3.5 fill-amber-500" />
                  ブックマーク済み
                </span>
              ) : null}
            </div>
          </article>
        </Link>
      ))}
    </div>
  );
}
