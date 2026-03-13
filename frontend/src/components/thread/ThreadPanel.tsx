'use client';

import { FormEvent, useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { buildProfileHref } from '@/lib/profileHref';
import supabase from '@/lib/supabase';
import { buildThreadTree, type ThreadTreeNode } from '@/lib/thread/buildThreadTree';
import type { ThreadNodeBase } from '@/types/offering';

type ThreadTable = 'note_comments' | 'question_answers';
type ParentColumn = 'parent_comment_id' | 'parent_answer_id';
type TargetColumn = 'note_id' | 'question_id';

type ThreadPanelProps = {
  nodes: ThreadNodeBase[];
  initialUserId: string | null;
  table: ThreadTable;
  targetColumn: TargetColumn;
  parentColumn: ParentColumn;
  targetId: string;
  emptyMessage: string;
  rootPlaceholder: string;
  replyPlaceholder: string;
  submitLabel: string;
  submitSuccessMessage: string;
  submitFailureMessage: string;
};

type ThreadWriteClient = {
  auth: {
    getUser: () => Promise<{ data: { user: { id: string } | null }; error: unknown | null }>;
  };
  from: (table: ThreadTable) => {
    insert: (payload: Record<string, unknown>) => Promise<{ error: { message?: string } | null }>;
  };
};

function formatDate(date: string) {
  return new Date(date).toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ThreadPanel({
  nodes,
  initialUserId,
  table,
  targetColumn,
  parentColumn,
  targetId,
  emptyMessage,
  rootPlaceholder,
  replyPlaceholder,
  submitLabel,
  submitSuccessMessage,
  submitFailureMessage,
}: ThreadPanelProps) {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(initialUserId);
  const [rootBody, setRootBody] = useState('');
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyBodies, setReplyBodies] = useState<Record<string, string>>({});
  const [submittingTargetId, setSubmittingTargetId] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const writeClient = supabase as unknown as ThreadWriteClient;

  const tree = useMemo(() => buildThreadTree(nodes), [nodes]);

  const resolveCurrentUserId = useCallback(async () => {
    if (currentUserId) {
      return currentUserId;
    }

    const {
      data: { user },
      error,
    } = await writeClient.auth.getUser();

    if (error) {
      console.error('[ThreadPanel] 認証確認エラー:', error);
      return null;
    }

    const nextUserId = user?.id ?? null;
    if (nextUserId) {
      setCurrentUserId(nextUserId);
    }
    return nextUserId;
  }, [currentUserId, writeClient.auth]);

  const submit = async (params: { body: string; parentId: string | null }) => {
    const body = params.body.trim();
    if (!body || submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setSubmittingTargetId(params.parentId ?? 'root');

    try {
      const userId = await resolveCurrentUserId();
      if (!userId) {
        toast.error('ログインが必要です');
        return;
      }

      const payload: Record<string, unknown> = {
        [targetColumn]: targetId,
        [parentColumn]: params.parentId,
        author_id: userId,
        body,
      };

      const { error } = await writeClient.from(table).insert(payload);

      if (error) {
        toast.error(error.message ?? submitFailureMessage);
        return;
      }

      toast.success(submitSuccessMessage);
      if (params.parentId) {
        setReplyBodies((prev) => ({ ...prev, [params.parentId as string]: '' }));
        setActiveReplyId(null);
      } else {
        setRootBody('');
      }
      router.refresh();
    } finally {
      submittingRef.current = false;
      setSubmittingTargetId(null);
    }
  };

  const renderNode = (node: ThreadTreeNode<ThreadNodeBase>) => {
    const isSubmittingThisReply = submittingTargetId === node.id;
    const replyValue = replyBodies[node.id] ?? '';
    const authorHref = buildProfileHref(node.author.id, currentUserId);

    return (
      <article key={node.id} className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <Link href={authorHref} className="shrink-0">
            {node.author.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={node.author.avatarUrl}
                alt={`${node.author.name}のアイコン`}
                className="h-7 w-7 rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
                {node.author.name.slice(0, 1)}
              </div>
            )}
          </Link>
          <p className="text-xs text-slate-500">
            <Link href={authorHref} className="font-semibold text-slate-700 hover:underline">
              {node.author.name}
            </Link>
            {' / '}
            {formatDate(node.createdAt)}
          </p>
        </div>

        <p className={`mt-2 whitespace-pre-wrap text-sm ${node.deletedAt ? 'italic text-slate-400' : 'text-slate-700'}`}>
          {node.deletedAt ? '削除された投稿です。' : node.body}
        </p>

        <div className="mt-2">
          <button
            type="button"
            onClick={() => setActiveReplyId((prev) => (prev === node.id ? null : node.id))}
            className="text-xs font-semibold text-blue-600 hover:text-blue-500"
            disabled={submittingRef.current}
          >
            返信する
          </button>
        </div>

        {activeReplyId === node.id ? (
          <form
            className="mt-3 space-y-2"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              void submit({ body: replyValue, parentId: node.id });
            }}
          >
            <textarea
              value={replyValue}
              onChange={(event) =>
                setReplyBodies((prev) => ({
                  ...prev,
                  [node.id]: event.target.value,
                }))
              }
              placeholder={replyPlaceholder}
              className="h-24 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800"
              disabled={submittingRef.current}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveReplyId(null)}
                className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                disabled={submittingRef.current}
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={isSubmittingThisReply}
                className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-slate-300"
              >
                {isSubmittingThisReply ? '送信中...' : submitLabel}
              </button>
            </div>
          </form>
        ) : null}

        {node.children.length > 0 ? (
          <div className="mt-3 space-y-3 border-l border-slate-200 pl-4">
            {node.children.map((child) => renderNode(child))}
          </div>
        ) : null}
      </article>
    );
  };

  const isSubmittingRoot = submittingTargetId === 'root';

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200/80 bg-white/85 p-5 shadow-sm">
      <form
        className="space-y-2"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          void submit({ body: rootBody, parentId: null });
        }}
      >
        <textarea
          value={rootBody}
          onChange={(event) => setRootBody(event.target.value)}
          placeholder={rootPlaceholder}
          className="h-28 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800"
          disabled={submittingRef.current}
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmittingRoot}
            className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
          >
            {isSubmittingRoot ? '送信中...' : submitLabel}
          </button>
        </div>
      </form>

      {tree.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          {emptyMessage}
        </p>
      ) : (
        <div className="space-y-3">{tree.map((node) => renderNode(node))}</div>
      )}
    </section>
  );
}
