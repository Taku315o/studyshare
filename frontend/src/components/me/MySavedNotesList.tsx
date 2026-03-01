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
  // ローディング中はスケルトンを表示
  if (isLoading) {
    return (
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={`my-saved-note-skeleton-${index}`}
            data-testid="my-saved-note-skeleton"
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
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
        保存したノートはまだありません。
      </p>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {savedNotes.map((note) => (
        <article key={note.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="line-clamp-1 text-lg font-semibold text-slate-900">{note.title}</h3>
          <p className="mt-2 line-clamp-3 text-sm text-slate-600">{note.body ?? '本文なし'}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            {note.savedByLike ? (
              <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">いいね済み</span>
            ) : null}
            {note.savedByBookmark ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                ブックマーク済み
              </span>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-slate-100 px-2.5 py-1">{note.offeringTitle}</span>
            <span>{note.instructorName}</span>
            <span>投稿: {formatDate(note.createdAt)}</span>
            <span>保存: {formatDate(note.savedAt)}</span>
          </div>
        </article>
      ))}
    </div>
  );
}
