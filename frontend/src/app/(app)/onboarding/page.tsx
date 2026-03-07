'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import type { SupabaseClient } from '@supabase/supabase-js';
import TimetableConfigPreview from '@/components/timetable/TimetableConfigPreview';
import TimetableSettingsModal from '@/components/timetable/TimetableSettingsModal';
import {
  DEFAULT_GLOBAL_TIMETABLE_CONFIG,
  loadEffectiveTimetableConfig,
  loadUniversityDefaultPreset,
  upsertUserTimetableSettings,
} from '@/lib/timetable/config';
import {
  GRADE_YEAR_OPTIONS,
  getValidationErrorMessage,
  profileSetupSchema,
} from '@/lib/validation/profile';
import { resolveSafeNextPath } from '@/lib/nextPath';
import { createSupabaseClient } from '@/lib/supabase/client';
import type { TimetableConfig } from '@/types/timetable';
import type { Database } from '@/types/supabase';

type UniversityOption = {
  id: string;
  name: string;
};

type ProfileSetupRow = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'display_name' | 'university_id' | 'grade_year' | 'faculty'
>;

function buildFallbackDisplayName(user: { email?: string | null; user_metadata?: Record<string, unknown> }) {
  const metadataName = typeof user.user_metadata?.name === 'string' ? user.user_metadata.name.trim() : '';
  if (metadataName) return metadataName;
  return user.email?.trim() || 'ユーザー';
}

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams?.get('next') || '/home';
  const supabase = useMemo(() => createSupabaseClient(), []);
  const typedSupabase = supabase as unknown as SupabaseClient<Database>;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [universities, setUniversities] = useState<UniversityOption[]>([]);
  const [selectedUniversityId, setSelectedUniversityId] = useState('');
  const [gradeYear, setGradeYear] = useState('');
  const [faculty, setFaculty] = useState('');
  const [isTimetableLoading, setIsTimetableLoading] = useState(false);
  const [isTimetableModalOpen, setIsTimetableModalOpen] = useState(false);
  const [isCustomTimetable, setIsCustomTimetable] = useState(false);
  const [hasBootstrapped, setHasBootstrapped] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [timetableConfig, setTimetableConfig] = useState<TimetableConfig>(DEFAULT_GLOBAL_TIMETABLE_CONFIG);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user) {
          router.replace('/');
          return;
        }

        const [profileRes, universitiesRes] = await Promise.all([
          typedSupabase
            .from('profiles')
            .select('display_name, university_id, grade_year, faculty')
            .eq('user_id', user.id)
            .maybeSingle(),
          typedSupabase.from('universities').select('id, name').order('name'),
        ]);

        if (profileRes.error) throw profileRes.error;
        if (universitiesRes.error) throw universitiesRes.error;
        if (!isMounted) return;

        const profileRow = (profileRes.data ?? null) as ProfileSetupRow | null;
        let resolved: Awaited<ReturnType<typeof loadEffectiveTimetableConfig>> = {
          config: DEFAULT_GLOBAL_TIMETABLE_CONFIG,
          presetId: null,
          source: 'global',
        };
        try {
          resolved = await loadEffectiveTimetableConfig(
            typedSupabase,
            user.id,
            profileRow?.university_id ?? null,
          );
        } catch (error) {
          console.error('[Onboarding] 時間割設定の取得に失敗しました。デフォルトを適用します:', error);
        }

        if (!isMounted) return;

        setUserId(user.id);
        setDisplayName(profileRow?.display_name?.trim() || buildFallbackDisplayName(user));
        setSelectedUniversityId(profileRow?.university_id ?? '');
        setGradeYear(profileRow?.grade_year ? String(profileRow.grade_year) : '');
        setFaculty(profileRow?.faculty ?? '');
        setUniversities((universitiesRes.data ?? []) as UniversityOption[]);
        setTimetableConfig(resolved.config);
        setSelectedPresetId(resolved.presetId);
        setIsCustomTimetable(resolved.source === 'user');
        setHasBootstrapped(true);
      } catch (error) {
        console.error('オンボーディング情報の取得に失敗しました:', error);
        if (!isMounted) return;
        setLoadError('初期設定の読み込みに失敗しました。時間をおいて再度お試しください。');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [router, supabase, typedSupabase]);

  useEffect(() => {
    if (!hasBootstrapped) return;
    if (!selectedUniversityId) {
      setTimetableConfig(DEFAULT_GLOBAL_TIMETABLE_CONFIG);
      setSelectedPresetId(null);
      return;
    }
    if (isCustomTimetable) {
      return;
    }

    let active = true;

    const loadPreset = async () => {
      setIsTimetableLoading(true);
      try {
        const resolved = await loadUniversityDefaultPreset(typedSupabase, selectedUniversityId);
        if (!active) return;
        setTimetableConfig(resolved.config);
        setSelectedPresetId(resolved.presetId);
      } catch (error) {
        console.error('[Onboarding] 標準時間割の取得に失敗しました:', error);
        if (!active) return;
        setTimetableConfig(DEFAULT_GLOBAL_TIMETABLE_CONFIG);
        setSelectedPresetId(null);
        toast.error('標準時間割の取得に失敗したため、共通設定を適用しました。');
      } finally {
        if (active) {
          setIsTimetableLoading(false);
        }
      }
    };

    void loadPreset();

    return () => {
      active = false;
    };
  }, [hasBootstrapped, isCustomTimetable, selectedUniversityId, typedSupabase]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSavingRef.current) {
      return;
    }
    if (!userId) {
      toast.error('ログイン情報を取得できませんでした');
      return;
    }
    const validation = profileSetupSchema.safeParse({
      universityId: selectedUniversityId,
      gradeYear,
      faculty,
    });
    if (!validation.success) {
      toast.error(getValidationErrorMessage(validation.error));
      return;
    }

    const { universityId: normalizedUniversityId, gradeYear: parsedGradeYear, faculty: normalizedFaculty } = validation.data;

    isSavingRef.current = true;
    setIsSaving(true);
    try {
      const { error } = await typedSupabase
        .from('profiles')
        .upsert(
          {
            user_id: userId,
            display_name: displayName.trim() || 'ユーザー',
            university_id: normalizedUniversityId,
            grade_year: parsedGradeYear,
            faculty: normalizedFaculty || null,
          },
          { onConflict: 'user_id' },
        );

      if (error) throw error;

      await upsertUserTimetableSettings(typedSupabase, {
        userId,
        presetId: selectedPresetId,
        config: timetableConfig,
      });

      toast.success('初期設定を保存しました');
      router.replace(resolveSafeNextPath(nextPath));
      router.refresh();
    } catch (error) {
      console.error('オンボーディング保存エラー:', error);
      toast.error('初期設定の保存に失敗しました');
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-2xl rounded-3xl border border-white/50 bg-white/75 p-8 shadow-sm backdrop-blur">
        <p className="text-sm text-slate-600">初期設定を読み込み中...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-2xl rounded-3xl border border-red-200 bg-red-50 p-8 text-sm text-red-700">
        {loadError}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <section className="rounded-3xl border border-white/50 bg-white/75 p-6 shadow-sm backdrop-blur">
        <h1 className="text-2xl font-bold text-slate-900">初期設定</h1>
        <p className="mt-2 text-sm text-slate-600">
          ノート・口コミ・質問の表示スコープに使うため、所属大学と学年を設定してください。
        </p>
      </section>

      <section className="rounded-3xl border border-white/50 bg-white/85 p-6 shadow-sm backdrop-blur">
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label htmlFor="onboarding-university" className="text-sm font-medium text-slate-700">
              所属大学
            </label>
            <select
              id="onboarding-university"
              value={selectedUniversityId}
              onChange={(event) => {
                setSelectedUniversityId(event.target.value);
                if (!isCustomTimetable) return;
                setIsCustomTimetable(false);
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800"
              disabled={isSaving}
              required
            >
              <option value="">大学を選択してください</option>
              {universities.map((university) => (
                <option key={university.id} value={university.id}>
                  {university.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="onboarding-grade-year" className="text-sm font-medium text-slate-700">
              学年
            </label>
            <select
              id="onboarding-grade-year"
              value={gradeYear}
              onChange={(event) => setGradeYear(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800"
              disabled={isSaving}
              required
            >
              <option value="">学年を選択してください</option>
              {GRADE_YEAR_OPTIONS.map((year) => (
                <option key={year} value={year}>
                  {year}年
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="onboarding-faculty" className="text-sm font-medium text-slate-700">
              学部（任意）
            </label>
            <input
              id="onboarding-faculty"
              type="text"
              value={faculty}
              onChange={(event) => setFaculty(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800"
              disabled={isSaving}
              placeholder="例: 経済学部"
            />
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
            <p className="text-sm font-semibold text-blue-800">この大学の標準時間割を適用します</p>
            <p className="mt-1 text-xs text-blue-700">あとからマイページ設定で変更できます。</p>
            {isTimetableLoading ? (
              <p className="mt-2 text-xs text-blue-700">標準時間割を読み込み中...</p>
            ) : (
              <TimetableConfigPreview config={timetableConfig} className="mt-2" />
            )}
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setIsTimetableModalOpen(true)}
                disabled={isSaving}
                className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100"
              >
                編集する
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">
            この設定により、同じ大学のユーザー同士でノート・口コミ・質問を閲覧できるようになります。
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving || isTimetableLoading}
              className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
            >
              {isSaving ? '保存中...' : 'このまま進む'}
            </button>
          </div>
        </form>
      </section>

      <TimetableSettingsModal
        isOpen={isTimetableModalOpen}
        title="時間割の時間・曜日を編集"
        description="オンボーディングでは標準設定を自動適用しています。必要ならここで調整できます。"
        saveLabel="この設定を使う"
        initialConfig={timetableConfig}
        isSaving={false}
        onClose={() => setIsTimetableModalOpen(false)}
        onSave={(nextConfig) => {
          setTimetableConfig(nextConfig);
          setIsCustomTimetable(true);
          setIsTimetableModalOpen(false);
        }}
      />
    </div>
  );
}
