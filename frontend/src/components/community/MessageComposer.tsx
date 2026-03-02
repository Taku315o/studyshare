'use client';
//メッセージ送信フォームのコンポーネント。ユーザーがメッセージを入力し、送信ボタンをクリックしてメッセージを送ることができる。
import { FormEvent, KeyboardEvent, useRef, useState } from 'react';

type MessageComposerProps = {
  onSend: (message: string) => Promise<void> | void;
  disabled?: boolean;
};

export default function MessageComposer({ onSend, disabled = false }: MessageComposerProps) {
  const [value, setValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  const submit = async () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isSubmittingRef.current) return;

    try {
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      await onSend(trimmed);
      setValue('');
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submit();
  };

  const handleKeyDown = async (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const isComposing = event.nativeEvent.isComposing || (event as unknown as { isComposing?: boolean }).isComposing;
    if (event.key !== 'Enter' || event.shiftKey || isComposing) return;
    event.preventDefault();
    await submit();
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        rows={2}
        placeholder="メッセージを入力..."
        disabled={disabled || isSubmitting}
        className="min-h-[44px] flex-1 resize-none rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-100"
      />
      <button
        type="submit"
        disabled={disabled || isSubmitting || value.trim().length === 0}
        className="h-11 rounded-full bg-blue-500 px-4 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-blue-300"
      >
        送信
      </button>
    </form>
  );
}
