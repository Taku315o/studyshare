import Link from 'next/link';
import { notFound } from 'next/navigation';
import ThreadPanel from '@/components/thread/ThreadPanel';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { ThreadNodeBase } from '@/types/offering';

type NoteRow = {
  id: string;
  offering_id: string;
  title: string;
  body_md: string | null;
  image_url: string | null;
  created_at: string;
  author_id: string;
};

type OfferingSummaryRow = {
  id: string;
  courses: { name: string | null } | Array<{ name: string | null }> | null;
};

type NoteCommentRow = {
  id: string;
  note_id: string;
  parent_comment_id: string | null;
  author_id: string;
  body: string;
  created_at: string;
  deleted_at: string | null;
};

function formatDate(date: string) {
  return new Date(date).toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function fetchProfiles(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userIds: string[],
) {
  if (userIds.length === 0) {
    return new Map<string, { display_name: string; avatar_url: string | null }>();
  }

  const { data } = await supabase.from('profiles').select('user_id, display_name, avatar_url').in('user_id', userIds);
  const rows = (data ?? []) as Array<{
    user_id: string;
    display_name: string;
    avatar_url: string | null;
  }>;

  const map = new Map<string, { display_name: string; avatar_url: string | null }>();
  rows.forEach((row) => {
    map.set(row.user_id, row);
  });
  return map;
}

export default async function OfferingNoteDetailPage({
  params,
}: {
  params: Promise<{ offeringId: string; noteId: string }>;
}) {
  const { offeringId, noteId } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [offeringRes, noteRes, commentsRes] = await Promise.all([
    supabase
      .from('course_offerings')
      .select('id, courses:course_id(name)')
      .eq('id', offeringId)
      .maybeSingle(),
    supabase
      .from('notes')
      .select('id, offering_id, title, body_md, image_url, created_at, author_id')
      .eq('id', noteId)
      .eq('offering_id', offeringId)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('note_comments')
      .select('id, note_id, parent_comment_id, author_id, body, created_at, deleted_at')
      .eq('note_id', noteId)
      .order('created_at', { ascending: true }),
  ]);

  if (!offeringRes.data || !noteRes.data || offeringRes.error || noteRes.error) {
    notFound();
  }

  const note = noteRes.data as NoteRow;
  const offering = offeringRes.data as OfferingSummaryRow;
  const noteComments = (commentsRes.data ?? []) as NoteCommentRow[];

  const profileMap = await fetchProfiles(
    supabase,
    Array.from(new Set([note.author_id, ...noteComments.map((comment) => comment.author_id)])),
  );

  const noteAuthor = profileMap.get(note.author_id);
  const commentNodes: ThreadNodeBase[] = noteComments.map((comment) => {
    const author = profileMap.get(comment.author_id);
    return {
      id: comment.id,
      parentId: comment.parent_comment_id,
      body: comment.body,
      createdAt: comment.created_at,
      deletedAt: comment.deleted_at,
      author: {
        id: comment.author_id,
        name: author?.display_name ?? '匿名ユーザー',
        avatarUrl: author?.avatar_url ?? null,
      },
    };
  });

  const visibleCommentCount = noteComments.filter((comment) => !comment.deleted_at).length;
  const courseNameSource = Array.isArray(offering.courses) ? offering.courses[0] : offering.courses;
  const courseName = courseNameSource?.name ?? '授業詳細';

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div className="rounded-3xl border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur">
        <Link href={`/offerings/${offeringId}?tab=notes`} className="text-sm font-semibold text-blue-600 hover:text-blue-500">
          ← {courseName} に戻る
        </Link>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">ノート詳細</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{note.title}</h1>
        <p className="mt-2 text-xs text-slate-500">
          {noteAuthor?.display_name ?? '匿名ユーザー'} / {formatDate(note.created_at)}
        </p>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{note.body_md ?? '本文なし'}</p>
        {note.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={note.image_url}
            alt={`${note.title} の添付画像`}
            className="mt-4 h-auto w-full rounded-2xl border border-slate-200 object-cover"
          />
        ) : null}
      </div>

      <div className="rounded-3xl border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur">
        <h2 className="text-lg font-semibold text-slate-900">コメント {visibleCommentCount}</h2>
        <p className="mt-1 text-xs text-slate-500">コメントと返信は時系列（古い順）で表示されます。</p>
        <div className="mt-4">
          <ThreadPanel
            nodes={commentNodes}
            initialUserId={user?.id ?? null}
            table="note_comments"
            targetColumn="note_id"
            parentColumn="parent_comment_id"
            targetId={note.id}
            emptyMessage="まだコメントはありません"
            rootPlaceholder="コメントを入力"
            replyPlaceholder="返信を入力"
            submitLabel="コメントする"
            submitSuccessMessage="コメントを投稿しました"
            submitFailureMessage="コメント投稿に失敗しました"
          />
        </div>
      </div>
    </div>
  );
}
