'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseClient } from '@/lib/supabase/client';
import type { Database } from '@/types/supabase';

type UniversityOption = {
  id: string;
  name: string;
};

type ProfileSetupRow = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'display_name' | 'university_id' | 'grade_year'
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [universities, setUniversities] = useState<UniversityOption[]>([]);
  const [selectedUniversityId, setSelectedUniversityId] = useState('');
  const [gradeYear, setGradeYear] = useState('');

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
            .select('display_name, university_id, grade_year')
            .eq('user_id', user.id)
            .maybeSingle(),
          typedSupabase.from('universities').select('id, name').order('name'),
        ]);

        if (profileRes.error) throw profileRes.error;
        if (universitiesRes.error) throw universitiesRes.error;
        if (!isMounted) return;

        const profileRow = (profileRes.data ?? null) as ProfileSetupRow | null;

        setUserId(user.id);
        setDisplayName(profileRow?.display_name?.trim() || buildFallbackDisplayName(user));
        setSelectedUniversityId(profileRow?.university_id ?? '');
        setGradeYear(profileRow?.grade_year ? String(profileRow.grade_year) : '');
        setUniversities((universitiesRes.data ?? []) as UniversityOption[]);
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId) {
      toast.error('ログイン情報を取得できませんでした');
      return;
    }
    if (!selectedUniversityId) {
      toast.error('大学を選択してください');
      return;
    }
    const parsedGradeYear = Number(gradeYear);
    if (!Number.isInteger(parsedGradeYear) || parsedGradeYear < 1 || parsedGradeYear > 8) {
      toast.error('学年を選択してください');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await typedSupabase
        .from('profiles')
        .upsert(
          {
            user_id: userId,
            display_name: displayName.trim() || 'ユーザー',
            university_id: selectedUniversityId,
            grade_year: parsedGradeYear,
          },
          { onConflict: 'user_id' },
        );

      if (error) throw error;

      toast.success('初期設定を保存しました');
      router.replace(nextPath.startsWith('/') ? nextPath : '/home');
      router.refresh();
    } catch (error) {
      console.error('オンボーディング保存エラー:', error);
      toast.error('初期設定の保存に失敗しました');
    } finally {
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
              onChange={(event) => setSelectedUniversityId(event.target.value)}
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
              {[1, 2, 3, 4, 5, 6].map((year) => (
                <option key={year} value={year}>
                  {year}年
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">
            この設定により、同じ大学のユーザー同士でノート・口コミ・質問を閲覧できるようになります。
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
            >
              {isSaving ? '保存中...' : '保存してはじめる'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
