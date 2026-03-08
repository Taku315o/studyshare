'use client';

import { useEffect } from 'react';

type TimetableEnrollmentConfirmModalProps = {
  open: boolean;
  mode: 'drop' | 'restore';
  courseTitle: string;
  isSubmitting: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
};

export default function TimetableEnrollmentConfirmModal({
  open,
  mode,
  courseTitle,
  isSubmitting,
  onConfirm,
  onClose,
}: TimetableEnrollmentConfirmModalProps) {
  useEffect(() => {
    if (!open || typeof document === 'undefined') return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const title = mode === 'drop' ? '時間割から外す' : '時間割に戻す';
  const body =
    mode === 'drop'
      ? `「${courseTitle}」を時間割から外しますか？`
      : `「${courseTitle}」を時間割に戻しますか？`;
  const subtext =
    mode === 'drop' ? '履修履歴は残り、「取消を表示」で再確認できます。' : null;
  const confirmLabel = mode === 'drop' ? '時間割から外す' : '再登録する';

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/45 p-4"
      onClick={(event) => {
        if (event.target !== event.currentTarget || isSubmitting) {
          return;
        }
        onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-3xl border border-white/70 bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-3 text-sm text-slate-700">{body}</p>
        {subtext ? <p className="mt-2 text-xs text-slate-500">{subtext}</p> : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={isSubmitting}
            className={[
              'rounded-full px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60',
              mode === 'drop' ? 'bg-rose-500 hover:bg-rose-400' : 'bg-blue-500 hover:bg-blue-400',
            ].join(' ')}
          >
            {isSubmitting ? '処理中...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
