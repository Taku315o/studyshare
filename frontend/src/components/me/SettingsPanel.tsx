'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import type { MeVisibilityUiState } from '@/types/me';

const VISIBILITY_HELP_TEXT: Record<MeVisibilityUiState['selected'], string> = {
  private: '履修の公開を行いません（将来機能）。',
  match_only: 'マッチング用途に限定して公開予定です（将来機能）。',
  public: '全体公開予定です（将来機能）。',
};

export default function SettingsPanel() {
  const { signOut } = useAuth();
  const [visibilityState, setVisibilityState] = useState<MeVisibilityUiState>({
    selected: 'match_only',
    helpText: VISIBILITY_HELP_TEXT.match_only,
  });

  const handleVisibilityChange = (nextValue: MeVisibilityUiState['selected']) => {
    setVisibilityState({
      selected: nextValue,
      helpText: VISIBILITY_HELP_TEXT[nextValue],
    });
  };

  const handleVisibilitySave = () => {
    toast.error('公開範囲の保存は Phase2 で対応予定です。');
  };

  return (
    <section className="rounded-3xl border border-white/50 bg-white/75 p-6 shadow-sm backdrop-blur">
      <h2 className="text-xl font-bold text-slate-900">設定</h2>
      <p className="mt-1 text-sm text-slate-600">ログアウトや公開範囲の設定を行えます。</p>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-800">公開範囲（将来のマッチング用）</p>
        <select
          value={visibilityState.selected}
          onChange={(event) => handleVisibilityChange(event.target.value as MeVisibilityUiState['selected'])}
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none"
        >
          <option value="private">private</option>
          <option value="match_only">match_only</option>
          <option value="public">public</option>
        </select>
        <p className="mt-2 text-xs text-slate-500">{visibilityState.helpText}</p>
        <button
          type="button"
          onClick={handleVisibilitySave}
          className="mt-3 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          公開範囲を保存
        </button>
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded-full border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
        >
          ログアウト
        </button>
      </div>
    </section>
  );
}
