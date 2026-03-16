'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import CreateOfferingModal from '@/components/timetable/CreateOfferingModal';
import OfferingSearchResultCard from '@/components/offerings/OfferingSearchResultCard';
import { buildOfferingFinderHref, type OfferingFinderContext, type OfferingFinderMode } from '@/lib/offerings/finder';
import { persistTimetableReturnHighlight } from '@/lib/timetable/add';
import { DEFAULT_GLOBAL_TIMETABLE_CONFIG, formatWeekdayLabel, loadEffectiveTimetableConfig } from '@/lib/timetable/config';
import { upsertEnrollment } from '@/lib/timetable/enrollment';
import { mapSearchResultRow } from '@/lib/timetable/search';
import { buildTermLabel, parseDateOnly, resolveDefaultTerm, sortTermsForSelector } from '@/lib/timetable/terms';
import { createSupabaseClient } from '@/lib/supabase/client';
import type {
  OfferingCatalogCoverage,
  TimetableConfig,
  TimetableSearchResult,
  TimetableStatus,
  TimetableTermOption,
  TimetableWeekday,
} from '@/types/timetable';

type OfferingFinderClientProps = {
  mode: OfferingFinderMode;
  initialContext: OfferingFinderContext;
};

type ProfileRow = {
  university_id: string | null;
  university: { name: string | null } | Array<{ name: string | null }> | null;
};

type TermRow = {
  id: string;
  academic_year: number;
  code: string;
  display_name: string;
  sort_key: number;
  start_date: string | null;
  end_date: string | null;
};

type SearchRpcRow = {
  offering_id: string;
  course_title: string | null;
  course_code: string | null;
  instructor: string | null;
  room: string | null;
  slot_labels: string[] | null;
  slot_details: unknown;
  slot_match: boolean | null;
  enrollment_count: number | null;
  my_status: TimetableStatus | null;
  created_at: string;
};

type CoverageRow = {
  coverage_kind: 'partial' | 'full';
  source_scope_labels: string[] | null;
};

function mergeCatalogCoverages(rows: CoverageRow[]): OfferingCatalogCoverage | null {
  if (rows.length === 0) return null;

  if (rows.some((row) => row.coverage_kind === 'full')) {
    return {
      coverageKind: 'full',
      sourceScopeLabels: [],
    };
  }

  const sourceScopeLabels = Array.from(new Set(rows.flatMap((row) => row.source_scope_labels ?? [])));

  return {
    coverageKind: 'partial',
    sourceScopeLabels,
  };
}

function normalizeOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function toTermOption(row: TermRow): TimetableTermOption {
  return {
    id: row.id,
    academicYear: row.academic_year,
    code: row.code,
    displayName: row.display_name,
    sortKey: row.sort_key,
    startDate: parseDateOnly(row.start_date),
    endDate: parseDateOnly(row.end_date),
  };
}

function formatCoverageScopePreview(labels: string[]) {
  if (labels.length === 0) return null;
  const previewLabels = labels.slice(0, 3);
  const remainingCount = labels.length - previewLabels.length;
  return remainingCount > 0 ? `${previewLabels.join('、')} ほか${remainingCount}件` : previewLabels.join('、');
}

export default function OfferingFinderClient({ mode, initialContext }: OfferingFinderClientProps) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseClient(), []);
  const typedSupabase = supabase;

  const [context, setContext] = useState(initialContext);
  const [searchInput, setSearchInput] = useState(initialContext.q);
  const [isMetaLoading, setIsMetaLoading] = useState(true);
  const [isResultsLoading, setIsResultsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [results, setResults] = useState<TimetableSearchResult[]>([]);
  const [termOptions, setTermOptions] = useState<TimetableTermOption[]>([]);
  const [timetableConfig, setTimetableConfig] = useState<TimetableConfig>(DEFAULT_GLOBAL_TIMETABLE_CONFIG);
  const [universityName, setUniversityName] = useState<string | null>(null);
  const [catalogCoverage, setCatalogCoverage] = useState<OfferingCatalogCoverage | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [submittingOfferingId, setSubmittingOfferingId] = useState<string | null>(null);

  useEffect(() => {
    setContext(initialContext);
    setSearchInput(initialContext.q);
  }, [initialContext]);

  useEffect(() => {
    let cancelled = false;

    const fetchMeta = async () => {
      setIsMetaLoading(true);
      setErrorMessage(null);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          if (!cancelled) {
            setUniversityName(null);
            setTermOptions([]);
            setTimetableConfig(DEFAULT_GLOBAL_TIMETABLE_CONFIG);
          }
          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('university_id, university:university_id(name)')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        const profile = (profileData ?? null) as ProfileRow | null;
        const university = normalizeOne(profile?.university ?? null);

        const configPromise = loadEffectiveTimetableConfig(typedSupabase, user.id, profile?.university_id ?? null).catch((error) => {
          console.error('[OfferingFinderClient] 時間割設定の取得に失敗しました。デフォルトを適用します:', error);
          return { config: DEFAULT_GLOBAL_TIMETABLE_CONFIG };
        });

        const termsPromise = profile?.university_id
          ? supabase
              .from('terms')
              .select('id, academic_year, code, display_name, sort_key, start_date, end_date')
              .eq('university_id', profile.university_id)
          : Promise.resolve({ data: [] as TermRow[], error: null });

        const [configResult, termsResult] = await Promise.all([configPromise, termsPromise]);

        if (termsResult.error) {
          throw termsResult.error;
        }

        if (cancelled) return;

        const nextTerms = sortTermsForSelector(((termsResult.data ?? []) as TermRow[]).map(toTermOption));
        setUniversityName(university?.name ?? null);
        setTermOptions(nextTerms);
        setTimetableConfig(configResult.config);

        if (!initialContext.termId && nextTerms.length > 0) {
          const nextTermId = resolveDefaultTerm(nextTerms, new Date())?.id ?? null;

          if (nextTermId) {
            const nextContext = { ...initialContext, termId: nextTermId };
            setContext(nextContext);
            router.replace(buildOfferingFinderHref(nextContext));
          }
        }
      } catch (error) {
        console.error('[OfferingFinderClient] 初期化エラー:', error);
        if (!cancelled) {
          setErrorMessage('講義検索の初期化に失敗しました。しばらくしてから再度お試しください。');
        }
      } finally {
        if (!cancelled) {
          setIsMetaLoading(false);
        }
      }
    };

    void fetchMeta();

    return () => {
      cancelled = true;
    };
  }, [initialContext, mode, router, supabase, typedSupabase]);

  useEffect(() => {
    let cancelled = false;

    const fetchCoverage = async () => {
      if (!context.termId) {
        setCatalogCoverage(null);
        return;
      }

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          if (!cancelled) {
            setCatalogCoverage(null);
          }
          return;
        }

        const coverageClient = supabase as unknown as {
          from: (table: 'offering_catalog_coverages') => {
            select: (
              columns: 'coverage_kind, source_scope_labels',
            ) => {
              eq: (
                column: 'term_id',
                value: string,
              ) => Promise<{ data: CoverageRow[] | null; error: { message?: string } | null }>;
            };
          };
        };

        const { data, error } = await coverageClient
          .from('offering_catalog_coverages')
          .select('coverage_kind, source_scope_labels')
          .eq('term_id', context.termId);

        if (error) {
          throw error;
        }

        if (!cancelled) {
          setCatalogCoverage(mergeCatalogCoverages(data ?? []));
        }
      } catch (error) {
        console.error('[OfferingFinderClient] 収録範囲の取得に失敗しました:', error);
        if (!cancelled) {
          setCatalogCoverage(null);
        }
      }
    };

    void fetchCoverage();

    return () => {
      cancelled = true;
    };
  }, [context.termId, supabase]);

  useEffect(() => {
    let cancelled = false;

    const fetchResults = async () => {
      if (!context.termId) {
        setResults([]);
        return;
      }

      setIsResultsLoading(true);
      setErrorMessage(null);

      try {
        const rpcClient = supabase as unknown as {
          rpc: (
            fn: 'search_timetable_offerings',
            args: {
              _term_id: string;
              _day_of_week: number | null;
              _period: number | null;
              _query: string | null;
              _limit: number;
              _offset: number;
            },
          ) => Promise<{ data: SearchRpcRow[] | null; error: { message?: string } | null }>;
        };

        const { data, error } = await rpcClient.rpc('search_timetable_offerings', {
          _term_id: context.termId,
          _day_of_week: mode === 'timetable-add' ? context.dayOfWeek : null,
          _period: mode === 'timetable-add' ? context.period : null,
          _query: context.q.trim() || null,
          _limit: 30,
          _offset: 0,
        });

        if (error) {
          throw error;
        }

        if (!cancelled) {
          setResults((data ?? []).map(mapSearchResultRow));
        }
      } catch (error) {
        console.error('[OfferingFinderClient] 検索エラー:', error);
        if (!cancelled) {
          setErrorMessage('授業検索に失敗しました。しばらくしてから再度お試しください。');
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setIsResultsLoading(false);
        }
      }
    };

    if (mode === 'browse' && !context.termId) {
      setResults([]);
      return;
    }

    void fetchResults();

    return () => {
      cancelled = true;
    };
  }, [context.dayOfWeek, context.period, context.q, context.termId, mode, supabase]);

  const selectedTerm = useMemo(
    () =>
      termOptions.find((term) => term.id === context.termId) ??
      resolveDefaultTerm(termOptions, new Date()),
    [context.termId, termOptions],
  );

  const safePeriodOptions = useMemo(() => {
    const options = timetableConfig.periods.map((period) => ({ period: period.period, label: period.label }));
    if (!context.period || options.some((option) => option.period === context.period)) {
      return options;
    }

    return [...options, { period: context.period, label: `${context.period}限` }].sort((left, right) => left.period - right.period);
  }, [context.period, timetableConfig.periods]);

  const contextLabel =
    mode === 'timetable-add' && context.dayOfWeek && context.period
      ? `${formatWeekdayLabel(context.dayOfWeek)}曜 ${context.period}限`
      : '授業・口コミ';

  const replaceRoute = (patch: Partial<OfferingFinderContext>) => {
    const nextContext = { ...context, ...patch, mode };
    setContext(nextContext);
    router.replace(buildOfferingFinderHref(nextContext));
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    replaceRoute({ q: searchInput.trim() });
  };

  const isSlotInConfig = (dayOfWeek: TimetableWeekday | null, period: number | null) => {
    if (!dayOfWeek || !period) return false;
    return timetableConfig.weekdays.includes(dayOfWeek) && timetableConfig.periods.some((entry) => entry.period === period);
  };

  const finalizeAndReturn = (value: { offeringId: string; dayOfWeek: TimetableWeekday | null; period: number | null }) => {
    if (mode !== 'timetable-add') {
      return;
    }

    persistTimetableReturnHighlight({
      offeringId: value.offeringId,
      dayOfWeek: value.dayOfWeek,
      period: value.period,
      location:
        value.dayOfWeek && value.period
          ? isSlotInConfig(value.dayOfWeek, value.period)
            ? 'grid'
            : 'out_of_config'
          : 'unslotted',
    });

    router.replace(context.returnTo ?? '/timetable');
  };

  const handleRegister = async (result: TimetableSearchResult) => {
    if (mode !== 'timetable-add' || submittingOfferingId || !context.termId) {
      return;
    }

    if (result.myStatus === 'enrolled' || result.myStatus === 'planned') {
      return;
    }

    setSubmittingOfferingId(result.offeringId);

    try {
      const mutation = await upsertEnrollment(typedSupabase, {
        offeringId: result.offeringId,
        status: 'enrolled',
      });

      if (!mutation.success) {
        toast.error(mutation.error || '時間割への追加に失敗しました');
        return;
      }

      if (mutation.alreadyActive) {
        toast.success('すでに追加済みです');
        return;
      }

      toast.success('時間割に追加しました');
      finalizeAndReturn({
        offeringId: result.offeringId,
        dayOfWeek: context.dayOfWeek ?? result.slotDetails[0]?.dayOfWeek ?? null,
        period: context.period ?? result.slotDetails[0]?.period ?? null,
      });
    } finally {
      setSubmittingOfferingId(null);
    }
  };

  const browseTermNotice = !context.termId && mode === 'browse';
  const timetableMissingTerm = !context.termId && mode === 'timetable-add';
  const detailBaseHref = '/offerings';
  const isPartialCoverage = catalogCoverage?.coverageKind === 'partial';
  const coverageScopePreview = formatCoverageScopePreview(catalogCoverage?.sourceScopeLabels ?? []);
  const emptyStateMessage = isPartialCoverage
    ? `条件に一致する授業が見つかりません。${mode === 'browse' ? '' : '新規作成を使って登録できます。 '}この学期の授業データは一部区分のみ収録中のため、未収録の可能性があります。`
    : mode === 'browse'
      ? '条件に一致する授業が見つかりません。'
      : '条件に一致する授業が見つかりません。新規作成を使って登録できます。';

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <section className="rounded-3xl border border-white/50 bg-white/80 p-6 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            {mode === 'timetable-add' ? (
              <button
                type="button"
                onClick={() => router.replace(context.returnTo ?? '/timetable')}
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                時間割へ戻る
              </button>
            ) : null}

            <h1 className={mode === 'timetable-add' ? 'mt-3 text-2xl font-bold text-slate-900' : 'text-2xl font-bold text-slate-900'}>
              {mode === 'timetable-add' ? `${contextLabel} の授業を追加` : contextLabel}
            </h1>

            <p className="mt-2 text-sm text-slate-600">
              {mode === 'browse'
                ? '授業を検索して、詳細ページでノート・口コミ・質問・受講者情報を確認できます。'
                : `大学: ${universityName ?? '未設定'} / 学期: ${selectedTerm ? buildTermLabel(selectedTerm) : '未設定'}`}
            </p>

            {mode === 'browse' ? (
              <p className="mt-2 text-sm text-slate-500">
                大学: {universityName ?? '未設定'} / 学期: {selectedTerm ? buildTermLabel(selectedTerm) : '未選択'}
              </p>
            ) : null}
          </div>

          {mode === 'timetable-add' ? (
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              disabled={!context.termId || isMetaLoading}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />＋ 新規作成
            </button>
          ) : null}
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row">
          <form onSubmit={handleSearchSubmit} className="flex flex-1 flex-col gap-3 sm:flex-row">
            <label className="flex h-11 flex-1 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="授業名または教員名で検索"
                className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
              />
            </label>
            <button
              type="submit"
              className="h-11 rounded-full bg-blue-500 px-6 text-sm font-semibold text-white transition hover:bg-blue-400"
            >
              検索
            </button>
          </form>

          <label className="flex h-11 min-w-[200px] items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-700">
            <span className="shrink-0 text-slate-500">学期</span>
            <select
              value={context.termId ?? ''}
              onChange={(event) => {
                replaceRoute({ termId: event.target.value || null });
              }}
              className="w-full bg-transparent text-sm focus:outline-none"
            >
              <option value="">選択してください</option>
              {termOptions.map((term) => (
                <option key={term.id} value={term.id}>
                  {buildTermLabel(term)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {isMetaLoading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">検索ページを読み込み中...</div>
      ) : null}

      {!isMetaLoading && errorMessage ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center text-sm text-rose-700">{errorMessage}</div>
      ) : null}

      {!isMetaLoading && !errorMessage ? (
        <section className="rounded-3xl border border-white/50 bg-white/80 p-5 shadow-sm backdrop-blur">
          {mode === 'timetable-add' && context.dayOfWeek && context.period && context.termId ? (
            <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-sm text-blue-900">
              {formatWeekdayLabel(context.dayOfWeek)}曜 {context.period}限 に一致する授業を優先表示しています。
            </div>
          ) : null}

          {isPartialCoverage ? (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-semibold">この学期の授業データは一部区分のみ収録中です。見つからない授業は未収録の可能性があります。</p>
              {coverageScopePreview ? <p className="mt-1 text-xs text-amber-900">収録中の区分: {coverageScopePreview}</p> : null}
            </div>
          ) : null}

          {browseTermNotice ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
              学期を選択すると授業を検索できます。
            </div>
          ) : null}

          {timetableMissingTerm ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
              学期データが未設定のため検索・登録を開始できません。
            </div>
          ) : null}

          {!browseTermNotice && !timetableMissingTerm ? (
            <>
              {isResultsLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">候補を読み込み中...</div>
              ) : null}

              {!isResultsLoading && results.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
                  {emptyStateMessage}
                </div>
              ) : null}

              {!isResultsLoading ? (
                <div className="space-y-3">
                  {results.map((result) => (
                    <OfferingSearchResultCard
                      key={result.offeringId}
                      mode={mode}
                      result={result}
                      detailHref={`${detailBaseHref}/${result.offeringId}`}
                      isSubmitting={submittingOfferingId === result.offeringId}
                      onRegister={mode === 'timetable-add' ? handleRegister : undefined}
                    />
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}

      {mode === 'timetable-add' ? (
        <CreateOfferingModal
          isOpen={isCreateModalOpen}
          universityName={universityName}
          periodOptions={safePeriodOptions}
          termOptions={termOptions}
          initialTermId={context.termId}
          initialDayOfWeek={context.dayOfWeek}
          initialPeriod={context.period}
          catalogCoverage={catalogCoverage}
          onClose={() => setIsCreateModalOpen(false)}
          onComplete={(value) => {
            setIsCreateModalOpen(false);
            finalizeAndReturn(value);
          }}
        />
      ) : null}
    </div>
  );
}
