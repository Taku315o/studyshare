'use client';
//チャットのメッセージ表示コンポーネント。会話の内容を表示し、ユーザーが送信したメッセージと相手からのメッセージを区別してスタイリングする。
import type { ChatMessageViewModel } from '@/types/community';

type ChatViewProps = {
  messages: ChatMessageViewModel[];
  currentUserId: string | null;
  isLoading: boolean;
  participantName: string;
};

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**currentUserId と senderId を比較して左右の吹き出しを切替、時刻を ja-JP 形式で表示。 */
export default function ChatView({ messages, currentUserId, isLoading, participantName }: ChatViewProps) {
  if (isLoading) {
    return <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">会話を読み込み中...</div>;
  }

  if (messages.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
        {participantName} さんとの会話はまだありません。最初のメッセージを送ってみましょう。
      </div>
    );
  }

  return (
    <div className="max-h-[32rem] space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3">
      {messages.map((message) => {
        const isMine = message.senderId === currentUserId;
        return (
          <div key={message.id} className={isMine ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={[
                'max-w-[85%] rounded-2xl px-3 py-2 text-sm',
                isMine ? 'rounded-br-md bg-blue-500 text-white' : 'rounded-bl-md bg-slate-100 text-slate-800',
              ].join(' ')}
            >
              <p className="whitespace-pre-wrap break-words">{message.body}</p>
              <p className={['mt-1 text-[10px]', isMine ? 'text-blue-100' : 'text-slate-500'].join(' ')}>{formatTime(message.createdAt)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
