'use client';

import { Heart, MessageCircle, Bookmark } from 'lucide-react';
import type { NoteListItem } from '@/types/offering';

type NoteCardProps = {
  note: NoteListItem;
  onToggleLike: (noteId: string, isLiked: boolean) => Promise<void>;
  onToggleBookmark: (noteId: string, isBookmarked: boolean) => Promise<void>;
};

function formatDate(date: string) {
  return new Date(date).toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NoteCard({ note, onToggleLike, onToggleBookmark }: NoteCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
          {note.authorName.slice(0, 1)}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">{note.authorName}</p>
          <p className="text-xs text-slate-500">{formatDate(note.createdAt)}</p>
        </div>
      </div>

      <h3 className="line-clamp-1 text-xl font-black tracking-tight text-slate-900">{note.title}</h3>
      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600">{note.body ?? '本文なし'}</p>
      {note.imageUrl ? (
        <img
          src={note.imageUrl}
          alt={`${note.title} の添付画像`}
          className="mt-3 h-44 w-full rounded-xl border border-slate-200 object-cover"
          loading="lazy"
        />
      ) : null}

      <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-rose-50"
          onClick={() => onToggleLike(note.id, note.isLikedByMe)}
        >
          <Heart
            className={`h-4 w-4 ${note.isLikedByMe ? 'fill-rose-500 text-rose-500' : 'text-slate-500'}`}
          />
          {note.likesCount}
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-amber-50"
          onClick={() => onToggleBookmark(note.id, note.isBookmarkedByMe)}
        >
          <Bookmark
            className={`h-4 w-4 ${note.isBookmarkedByMe ? 'fill-amber-500 text-amber-500' : 'text-slate-500'}`}
          />
          {note.bookmarksCount}
        </button>
        <span className="inline-flex items-center gap-1 px-2 py-1">
          <MessageCircle className="h-4 w-4 text-slate-500" />
          {note.commentsCount}
        </span>
      </div>
    </article>
  );
}
