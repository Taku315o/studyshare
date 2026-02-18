import type { MeNoteItemViewModel } from '@/types/me';

type MyNotesListProps = {
  notes: MeNoteItemViewModel[];
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

export default function MyNotesList({ notes, isLoading }: MyNotesListProps) {
  if (isLoading) {
    return (
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={`my-note-skeleton-${index}`} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="h-5 w-2/3 rounded-full bg-slate-200" />
            <div className="mt-2 h-3 w-full rounded-full bg-slate-200" />
            <div className="mt-4 h-3 w-1/2 rounded-full bg-slate-200" />
          </div>
        ))}
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
        まだノートを投稿していません。
      </p>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {notes.map((note) => (
        <article key={note.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="line-clamp-1 text-lg font-semibold text-slate-900">{note.title}</h3>
          <p className="mt-2 line-clamp-3 text-sm text-slate-600">{note.body ?? '本文なし'}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-slate-100 px-2.5 py-1">{note.offeringTitle}</span>
            <span>{note.instructorName}</span>
            <span>{formatDate(note.createdAt)}</span>
          </div>
        </article>
      ))}
    </div>
  );
}
