'use client';

import { MoreHorizontal, X } from 'lucide-react';
import ChatView from '@/components/community/ChatView';
import MessageComposer from '@/components/community/MessageComposer';
import ThreadList from '@/components/community/ThreadList';
import type { ChatMessageViewModel, ThreadSummaryViewModel } from '@/types/community';

type MessagesPaneProps = {
  unreadCount: number;
  threads: ThreadSummaryViewModel[];
  selectedThreadId: string | null;
  selectedThread: ThreadSummaryViewModel | null;
  messages: ChatMessageViewModel[];
  currentUserId: string | null;
  threadsLoading: boolean;
  messagesLoading: boolean;
  messagesError: string | null;
  fallbackNotice: string | null;
  onSelectThread: (threadId: string) => void;
  onSendMessage: (message: string) => Promise<void>;
  onRequestCloseMobile?: () => void;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function MessagesPane({
  unreadCount,
  threads,
  selectedThreadId,
  selectedThread,
  messages,
  currentUserId,
  threadsLoading,
  messagesLoading,
  messagesError,
  fallbackNotice,
  onSelectThread,
  onSendMessage,
  onRequestCloseMobile,
}: MessagesPaneProps) {
  return (
    <section className="flex h-full min-h-[42rem] flex-col rounded-3xl border border-white/60 bg-white/80 p-5 shadow-sm backdrop-blur">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-slate-900">メッセージ ({unreadCount})</h2>
        </div>
        <div className="flex items-center gap-2">
          {onRequestCloseMobile ? (
            <button
              type="button"
              onClick={onRequestCloseMobile}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 lg:hidden"
              aria-label="メッセージを閉じる"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600"
            aria-label="メッセージメニュー"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <ThreadList
          threads={threads}
          selectedThreadId={selectedThreadId}
          onSelectThread={onSelectThread}
          isLoading={threadsLoading}
        />

        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {selectedThread ? (
            <>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                {selectedThread.participantAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedThread.participantAvatarUrl}
                    alt={selectedThread.participantName}
                    className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/15 text-xs font-bold text-blue-700">
                    {initials(selectedThread.participantName)}
                  </div>
                )}

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{selectedThread.participantName}</p>
                  <p className="truncate text-xs text-slate-500">{selectedThread.participantAffiliation}</p>
                </div>
              </div>

              {fallbackNotice ? (
                <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{fallbackNotice}</p>
              ) : null}

              {messagesError ? (
                <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{messagesError}</p>
              ) : null}

              <div className="min-h-0 flex-1">
                <ChatView
                  messages={messages}
                  currentUserId={currentUserId}
                  isLoading={messagesLoading}
                  participantName={selectedThread.participantName}
                />
              </div>

              <MessageComposer onSend={onSendMessage} disabled={!currentUserId} />
            </>
          ) : (
            <div className="flex h-full min-h-[20rem] flex-col justify-center gap-3">
              {fallbackNotice ? (
                <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{fallbackNotice}</p>
              ) : null}
              <div className="flex min-h-[20rem] items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">
                スレッドを選択すると会話が表示されます。
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
