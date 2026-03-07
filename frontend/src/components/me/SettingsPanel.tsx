'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import toast from 'react-hot-toast';
import TimetableConfigPreview from '@/components/timetable/TimetableConfigPreview';
import TimetableSettingsModal from '@/components/timetable/TimetableSettingsModal';
import { useAuth } from '@/context/AuthContext';
import {
  DEFAULT_GLOBAL_TIMETABLE_CONFIG,
  loadEffectiveTimetableConfig,
  upsertUserTimetableSettings,
} from '@/lib/timetable/config';
import type { TimetableConfig } from '@/types/timetable';
import type { MeVisibilityUiState } from '@/types/me';
import type { Database } from '@/types/supabase';
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

type ProfileSettingsRow = {
  enrollment_visibility_default: MeVisibilityUiState['selected'] | null;
  university_id: string | null;
};

export default function SettingsPanel() {
  const { signOut } = useAuth();
  const supabaseClient = supabase;
  const typedSupabase = supabaseClient as unknown as SupabaseClient<Database>;
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const [isVisibilityModalOpen, setIsVisibilityModalOpen] = useState(false);
  const [visibilityState, setVisibilityState] = useState<MeVisibilityUiState>({
    selected: 'match_only',
    helpText: VISIBILITY_HELP_TEXT.match_only,
  });
  const [isLoadingVisibility, setIsLoadingVisibility] = useState(true);
  const [isSavingVisibility, setIsSavingVisibility] = useState(false);
  const isSavingVisibilityRef = useRef(false);

  const [timetableConfig, setTimetableConfig] = useState<TimetableConfig>(DEFAULT_GLOBAL_TIMETABLE_CONFIG);
  const [timetablePresetId, setTimetablePresetId] = useState<string | null>(null);
  const [isLoadingTimetable, setIsLoadingTimetable] = useState(true);
  const [isSavingTimetable, setIsSavingTimetable] = useState(false);
  const [isTimetableModalOpen, setIsTimetableModalOpen] = useState(false);
  const isSavingTimetableRef = useRef(false);
  const hasOpenedFromQueryRef = useRef(false);

  useEffect(() => {
    let active = true;

    const loadSettings = async () => {
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
          .select('enrollment_visibility_default, university_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!active) {
          return;
        }

        const profile = data as ProfileSettingsRow | null;
        const selected = profile?.enrollment_visibility_default ?? 'match_only';
        setVisibilityState({
          selected,
          helpText: VISIBILITY_HELP_TEXT[selected],
        });

        try {
          const resolved = await loadEffectiveTimetableConfig(
            typedSupabase,
            user.id,
            profile?.university_id ?? null,
          );

          if (!active) {
            return;
          }

          setTimetableConfig(resolved.config);
          setTimetablePresetId(resolved.presetId);
        } catch (error) {
          console.error('[SettingsPanel] 時間割設定の取得に失敗しました。デフォルトを適用します:', error);
          if (active) {
            setTimetableConfig(DEFAULT_GLOBAL_TIMETABLE_CONFIG);
            setTimetablePresetId(null);
          }
        }
      } catch (error) {
        console.error('[SettingsPanel] 設定取得エラー:', error);
        if (active) {
          toast.error('設定の取得に失敗しました');
        }
      } finally {
        if (active) {
          setIsLoadingVisibility(false);
          setIsLoadingTimetable(false);
        }
      }
    };

    void loadSettings();

    return () => {
      active = false;
    };
  }, [supabaseClient, typedSupabase]);

  useEffect(() => {
    if (!searchParams || hasOpenedFromQueryRef.current) {
      return;
    }

    if (searchParams.get('modal') === 'timetable-settings') {
      setIsTimetableModalOpen(true);
      hasOpenedFromQueryRef.current = true;
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isVisibilityModalOpen || typeof document === 'undefined') return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isVisibilityModalOpen]);

  const closeTimetableModal = () => {
    setIsTimetableModalOpen(false);

    if (!searchParams || searchParams.get('modal') !== 'timetable-settings') {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('modal');
    nextParams.delete('from');
    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

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

  const handleSaveTimetable = async (nextConfig: TimetableConfig) => {
    if (isSavingTimetableRef.current || isLoadingTimetable) {
      return;
    }

    isSavingTimetableRef.current = true;
    setIsSavingTimetable(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        toast.error('ログイン情報を取得できませんでした');
        return;
      }

      const savedConfig = await upsertUserTimetableSettings(
        typedSupabase,
        {
          userId: user.id,
          presetId: timetablePresetId,
          config: nextConfig,
        },
      );

      setTimetableConfig(savedConfig);
      closeTimetableModal();
      toast.success('時間割の時間・曜日を保存しました');
    } catch (error) {
      console.error('[SettingsPanel] 時間割設定保存エラー:', error);
      toast.error('時間割設定の保存に失敗しました');
    } finally {
      isSavingTimetableRef.current = false;
      setIsSavingTimetable(false);
    }
  };

  return (
    <section className="rounded-3xl border border-white/50 bg-white/75 p-6 shadow-sm backdrop-blur">
      <h2 className="text-xl font-bold text-slate-900">設定</h2>
      <p className="mt-1 text-sm text-slate-600">ログアウトや公開範囲の設定を行えます。</p>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-800">時間割の時間・曜日</p>
        <p className="mt-2 text-xs text-slate-500">設定は時間割ページにも反映されます。</p>
        {!isLoadingTimetable ? <TimetableConfigPreview config={timetableConfig} className="mt-3" /> : null}
        {searchParams?.get('from') === 'timetable' ? (
          <p className="mt-2 text-xs text-blue-700">時間割ページから遷移しました。ここで設定を編集できます。</p>
        ) : null}
        <button
          type="button"
          onClick={() => setIsTimetableModalOpen(true)}
          disabled={isLoadingTimetable || isSavingTimetable}
          className="mt-3 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          時間・曜日を設定
        </button>
      </div>

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

      <div className="mt-4">
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded-full border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
        >
          ログアウト
        </button>
      </div>

      <TimetableSettingsModal
        isOpen={isTimetableModalOpen}
        title="時間割の時間・曜日を編集"
        description="ここで変更した内容は時間割ページの表示に反映されます。"
        saveLabel="時間割設定を保存"
        initialConfig={timetableConfig}
        isSaving={isSavingTimetable}
        onClose={closeTimetableModal}
        onSave={handleSaveTimetable}
      />

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
