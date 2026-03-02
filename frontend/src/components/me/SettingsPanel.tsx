'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import type { MeVisibilityUiState } from '@/types/me';
import supabase from '@/lib/supabase';

const VISIBILITY_HELP_TEXT: Record<MeVisibilityUiState['selected'], string> = {
  private: '履修の公開を行いません（将来機能）。',
  match_only: 'マッチング用途に限定して公開予定です（将来機能）。',
  public: '全体公開予定です（将来機能）。',
};

const VISIBILITY_LABEL_TEXT: Record<MeVisibilityUiState['selected'], string> = {
  private: '非公開',
  match_only: 'マッチング用途のみ',
  public: '全体公開',
};

type VisibilityProfileRow = {
  enrollment_visibility_default: MeVisibilityUiState['selected'] | null;
};

export default function SettingsPanel() {
  const { signOut } = useAuth();
  const supabaseClient = supabase;
  const [isVisibilityModalOpen, setIsVisibilityModalOpen] = useState(false);
  const [visibilityState, setVisibilityState] = useState<MeVisibilityUiState>({
    selected: 'match_only',
    helpText: VISIBILITY_HELP_TEXT.match_only,
  });
  const [isLoadingVisibility, setIsLoadingVisibility] = useState(true);
  const [isSavingVisibility, setIsSavingVisibility] = useState(false);
  const isSavingVisibilityRef = useRef(false);

  useEffect(() => {
    let active = true;

    const loadVisibility = async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          return;
        }

        const { data, error } = await supabaseClient
          .from('profiles')
          .select('enrollment_visibility_default')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          throw error;
        }

        const profile = data as VisibilityProfileRow | null;
        const selected = profile?.enrollment_visibility_default ?? 'match_only';

        if (!active) {
          return;
        }

        setVisibilityState({
          selected,
          helpText: VISIBILITY_HELP_TEXT[selected],
        });
      } catch (error) {
        console.error('[SettingsPanel] 公開範囲取得エラー:', error);
        if (active) {
          toast.error('公開範囲の取得に失敗しました');
        }
      } finally {
        if (active) {
          setIsLoadingVisibility(false);
        }
      }
    };

    loadVisibility();

    return () => {
      active = false;
    };
  }, [supabaseClient]);

  useEffect(() => {
    if (!isVisibilityModalOpen || typeof document === 'undefined') return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isVisibilityModalOpen]);

  const handleVisibilityChange = (nextValue: MeVisibilityUiState['selected']) => {
    setVisibilityState({
      selected: nextValue,
      helpText: VISIBILITY_HELP_TEXT[nextValue],
    });
  };

  const isVisibilitySaveLocked = isLoadingVisibility || isSavingVisibility;

  const handleVisibilitySave = async () => {
    if (isLoadingVisibility || isSavingVisibilityRef.current) {
      return;
    }

    isSavingVisibilityRef.current = true;
    setIsSavingVisibility(true);
    try {
      const rpcClient = supabaseClient as unknown as {
        rpc: (
          fn: 'update_visibility_settings',
          args: { new_visibility: MeVisibilityUiState['selected'] }
        ) => Promise<{ error: unknown | null }>;
      };
      const { error } = await rpcClient.rpc('update_visibility_settings', {
        new_visibility: visibilityState.selected,
      });

      if (error) {
        throw error;
      }

      toast.success('公開範囲を保存し、履修データへ反映しました');
      setIsVisibilityModalOpen(false);
    } catch (error) {
      console.error('[SettingsPanel] 公開範囲保存エラー:', error);
      toast.error('公開範囲の保存に失敗しました');
    } finally {
      isSavingVisibilityRef.current = false;
      setIsSavingVisibility(false);
    }
  };

  return (
    <section className="rounded-3xl border border-white/50 bg-white/75 p-6 shadow-sm backdrop-blur">
      <h2 className="text-xl font-bold text-slate-900">設定</h2>
      <p className="mt-1 text-sm text-slate-600">ログアウトや公開範囲の設定を行えます。</p>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-800">公開範囲（将来のマッチング用）</p>
        <p className="mt-2 text-sm font-medium text-slate-700">{VISIBILITY_LABEL_TEXT[visibilityState.selected]}</p>
        <p className="mt-2 text-xs text-slate-500">{visibilityState.helpText}</p>
        <button
          type="button"
          onClick={() => setIsVisibilityModalOpen(true)}
          disabled={isLoadingVisibility || isSavingVisibility}
          className="mt-3 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          公開範囲を設定
        </button>
      </div>

      {/* NOTE: dm_scope はスキーマ上は保持しているが、MVP中はDM判定に未反映。
          現在のDM開始可否は allow_dm と送信者側の解放条件で判定される。 */}

      <div className="mt-4">
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded-full border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
        >
          ログアウト
        </button>
      </div>

      {isVisibilityModalOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4"
              data-testid="settings-visibility-modal-overlay"
              onClick={(event) => {
                if (event.target !== event.currentTarget || isSavingVisibility) {
                  return;
                }
                setIsVisibilityModalOpen(false);
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                className="w-full max-w-md rounded-2xl border border-white/60 bg-white p-6 shadow-xl"
                onClick={(event) => event.stopPropagation()}
              >
                <h3 className="text-lg font-semibold text-slate-900">公開範囲設定</h3>
                <p className="mt-1 text-sm text-slate-600">将来のマッチング機能に使う履修公開範囲を設定します。</p>

                <label className="mt-5 block">
                  <span className="text-sm font-medium text-slate-700">公開範囲</span>
                  <select
                    value={visibilityState.selected}
                    onChange={(event) => handleVisibilityChange(event.target.value as MeVisibilityUiState['selected'])}
                    disabled={isVisibilitySaveLocked}
                    className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none"
                  >
                    <option value="private">private</option>
                    <option value="match_only">match_only</option>
                    <option value="public">public</option>
                  </select>
                </label>
                <p className="mt-2 text-xs text-slate-500">{visibilityState.helpText}</p>

                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsVisibilityModalOpen(false)}
                    disabled={isSavingVisibility}
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={handleVisibilitySave}
                    disabled={isVisibilitySaveLocked}
                    className="rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {isSavingVisibility ? '保存中...' : '公開範囲を保存'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
