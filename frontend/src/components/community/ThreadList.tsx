'use client';

import Link from 'next/link';
import type { ThreadSummaryViewModel } from '@/types/community';

type ThreadListProps = {
  threads: ThreadSummaryViewModel[];
  selectedThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  isLoading: boolean;
};

function formatDate(value: string | null) {
  if (!value) return 'まだ会話がありません';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '日時不明';
  return date.toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function canLinkToProfile(userId: string) {
  return Boolean(userId) && userId !== 'unknown';
}

export default function ThreadList({ threads, selectedThreadId, onSelectThread, isLoading }: ThreadListProps) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">スレッドを読み込み中...</div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
        スレッドがありません。左の候補からメッセージを始めてください。
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {threads.map((thread) => {
        const isActive = thread.threadId === selectedThreadId;
        const profileLinkable = canLinkToProfile(thread.participantId);
        const profileHref = `/profile/${thread.participantId}`;

        return (
          <li key={thread.threadId}>
            <div
              role="button"
              tabIndex={0}
              aria-pressed={isActive}
              onClick={() => onSelectThread(thread.threadId)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                onSelectThread(thread.threadId);
              }}
              className={[
                'w-full rounded-2xl border px-3 py-2 text-left transition-colors',
                isActive
                  ? 'border-blue-300 bg-blue-50/80'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
              ].join(' ')}
            >
              <div className="flex items-start gap-2">
                {profileLinkable ? (
                  <Link href={profileHref} className="shrink-0" onClick={(event) => event.stopPropagation()}>
                    {thread.participantAvatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thread.participantAvatarUrl}
                        alt={thread.participantName}
                        className="h-9 w-9 rounded-full border border-slate-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/15 text-xs font-bold text-blue-700">
                        {initials(thread.participantName)}
                      </div>
                    )}
                  </Link>
                ) : (
                  thread.participantAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thread.participantAvatarUrl}
                      alt={thread.participantName}
                      className="h-9 w-9 rounded-full border border-slate-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/15 text-xs font-bold text-blue-700">
                      {initials(thread.participantName)}
                    </div>
                  )
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex items-center gap-2">
                      {profileLinkable ? (
                        <Link
                          href={profileHref}
                          className="truncate text-sm font-semibold text-slate-800 hover:underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {thread.participantName}
                        </Link>
                      ) : (
                        <p className="truncate text-sm font-semibold text-slate-800">{thread.participantName}</p>
                      )}
                      {thread.unreadCount > 0 ? (
                        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          {thread.unreadCount}
                        </span>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-500">{formatDate(thread.lastMessageAt)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{thread.participantAffiliation}</p>
                  <p className={['mt-1 truncate text-xs', thread.unreadCount > 0 ? 'font-semibold text-slate-800' : 'text-slate-600'].join(' ')}>
                    {thread.lastMessagePreview || 'まだメッセージはありません'}
                  </p>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
