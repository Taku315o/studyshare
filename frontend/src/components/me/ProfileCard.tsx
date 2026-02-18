'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { MeProfileViewModel } from '@/types/me';

type ProfileCardProps = {
  profile: MeProfileViewModel | null;
  isLoading: boolean;
  isSaving: boolean;
  onSaveDisplayName: (displayName: string) => Promise<void>;
};

export default function ProfileCard({ profile, isLoading, isSaving, onSaveDisplayName }: ProfileCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isModalOpen) return;
    setDisplayNameInput(profile?.displayName ?? '');
    setSubmitErrorMessage(null);
  }, [isModalOpen, profile?.displayName]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextName = displayNameInput.trim();
    if (!nextName) {
      setSubmitErrorMessage('表示名を入力してください。');
      return;
    }

    setSubmitErrorMessage(null);

    try {
      await onSaveDisplayName(nextName);
      setIsModalOpen(false);
    } catch {
      setSubmitErrorMessage('プロフィール更新に失敗しました。');
    }
  };

  const avatarInitial = profile?.displayName?.slice(0, 1) ?? 'U';
  const hasAvatar = Boolean(profile?.avatarUrl);

  return (
    <section className="rounded-3xl border border-white/50 bg-white/75 p-6 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div
            className={[
              'flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold',
              hasAvatar ? 'bg-cover bg-center text-transparent' : 'bg-slate-200 text-slate-700',
            ].join(' ')}
            style={hasAvatar ? { backgroundImage: `url(${profile?.avatarUrl})` } : undefined}
            aria-label="avatar"
          >
            {hasAvatar ? 'avatar' : avatarInitial}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">プロフィール</h2>
            {isLoading ? (
              <p className="mt-1 text-sm text-slate-500">読み込み中...</p>
            ) : (
              <>
                <p className="mt-1 text-base font-semibold text-slate-800">
                  {profile?.displayName || '表示名が未設定です'}
                </p>
                <p className="text-sm text-slate-600">{profile?.affiliation || '所属情報が未設定です'}</p>
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          disabled={isLoading}
          className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          プロフィール編集
        </button>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/60 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">プロフィール編集</h3>
            <p className="mt-1 text-sm text-slate-600">display_name を更新できます。</p>

            <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">表示名</span>
                <input
                  name="displayName"
                  type="text"
                  value={displayNameInput}
                  onChange={(event) => setDisplayNameInput(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none"
                />
              </label>

              {submitErrorMessage ? <p className="text-sm text-red-600">{submitErrorMessage}</p> : null}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isSaving ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
