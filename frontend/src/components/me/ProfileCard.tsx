'use client';

import { FormEvent, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  GRADE_YEAR_OPTIONS,
  getValidationErrorMessage,
  profileEditSchema,
} from '@/lib/validation/profile';
import type { MeProfileViewModel, MeUniversityOption } from '@/types/me';

type ProfileCardProps = {
  profile: MeProfileViewModel | null;
  universities: MeUniversityOption[];
  isLoading: boolean;
  isSaving: boolean;
  onSaveProfile: (params: {
    displayName: string;
    universityId: string;
    gradeYear: number;
    faculty: string;
    avatarFile: File | null;
  }) => Promise<void>;
};

export default function ProfileCard({
  profile,
  universities,
  isLoading,
  isSaving,
  onSaveProfile,
}: ProfileCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [selectedUniversityId, setSelectedUniversityId] = useState('');
  const [gradeYearInput, setGradeYearInput] = useState('');
  const [facultyInput, setFacultyInput] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarInputKey, setAvatarInputKey] = useState(0);
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isModalOpen) return;
    setDisplayNameInput(profile?.displayName ?? '');
    setSelectedUniversityId(profile?.universityId ?? '');
    setGradeYearInput(profile?.gradeYear ? String(profile.gradeYear) : '');
    setFacultyInput(profile?.faculty ?? '');
    setAvatarFile(null);
    setAvatarInputKey((prev) => prev + 1);
    setSubmitErrorMessage(null);
  }, [isModalOpen, profile?.displayName, profile?.faculty, profile?.gradeYear, profile?.universityId]);

  useEffect(() => {
    if (!isModalOpen || typeof document === 'undefined') return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isModalOpen]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving || isLoading) {
      return;
    }
    const validation = profileEditSchema.safeParse({
      displayName: displayNameInput,
      universityId: selectedUniversityId,
      gradeYear: gradeYearInput,
      faculty: facultyInput,
    });
    if (!validation.success) {
      setSubmitErrorMessage(getValidationErrorMessage(validation.error));
      return;
    }

    setSubmitErrorMessage(null);

    try {
      await onSaveProfile({
        ...validation.data,
        avatarFile,
      });
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
                <p className="text-sm text-slate-600">
                  {profile?.universityName ? `${profile.universityName}${profile.gradeYear ? ` / ${profile.gradeYear}年` : ''}` : '大学・学年が未設定です'}
                </p>
                <p className="text-sm text-slate-600">{profile?.faculty || '学部未設定'}</p>
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

      {isModalOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4"
              data-testid="profile-edit-modal-overlay"
              onClick={(event) => {
                if (event.target !== event.currentTarget || isSaving) {
                  return;
                }
                setIsModalOpen(false);
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                className="w-full max-w-md rounded-2xl border border-white/60 bg-white p-6 shadow-xl"
                onClick={(event) => event.stopPropagation()}
              >
                <h3 className="text-lg font-semibold text-slate-900">プロフィール編集</h3>
                <p className="mt-1 text-sm text-slate-600">表示名・所属大学・学年・学部・アバター画像を更新できます。</p>

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

                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">所属大学</span>
                    <select
                      name="universityId"
                      value={selectedUniversityId}
                      onChange={(event) => setSelectedUniversityId(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none"
                      disabled={isSaving || isLoading}
                    >
                      <option value="">大学を選択してください</option>
                      {universities.map((university) => (
                        <option key={university.id} value={university.id}>
                          {university.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">学年</span>
                    <select
                      name="gradeYear"
                      value={gradeYearInput}
                      onChange={(event) => setGradeYearInput(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none"
                      disabled={isSaving || isLoading}
                    >
                      <option value="">学年を選択してください</option>
                      {GRADE_YEAR_OPTIONS.map((year) => (
                        <option key={year} value={year}>
                          {year}年
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">学部（任意）</span>
                    <input
                      name="faculty"
                      type="text"
                      value={facultyInput}
                      onChange={(event) => setFacultyInput(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none"
                      disabled={isSaving || isLoading}
                      placeholder="例: 経済学部"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">アバター画像（任意）</span>
                    <input
                      key={avatarInputKey}
                      name="avatar"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) => setAvatarFile(event.currentTarget.files?.[0] ?? null)}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none"
                      disabled={isSaving || isLoading}
                    />
                  </label>

                  {submitErrorMessage ? <p className="text-sm text-red-600">{submitErrorMessage}</p> : null}

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      disabled={isSaving}
                      className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
