'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, Plus, Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import CreateOfferingModal from '@/components/timetable/CreateOfferingModal';
import {
  buildTimetableAddHref,
  persistTimetableReturnHighlight,
  readTimetableAddContext,
} from '@/lib/timetable/add';
import { formatWeekdayLabel, loadEffectiveTimetableConfig, DEFAULT_GLOBAL_TIMETABLE_CONFIG } from '@/lib/timetable/config';
import { upsertEnrollment } from '@/lib/timetable/enrollment';
import { mapSearchResultRow } from '@/lib/timetable/search';
import { formatSeasonLabel, parseDateAtStartOfDay, resolveCurrentTerm, sortTermsDescending } from '@/lib/timetable/terms';
import { createSupabaseClient } from '@/lib/supabase/client';
import type {
  TimetableConfig,
  TimetableSearchResult,
  TimetableStatus,
  TimetableTermOption,
  TimetableWeekday,
} from '@/types/timetable';

type ProfileRow = {
  university_id: string | null;
  university: { name: string | null } | Array<{ name: string | null }> | null;
};

type TermRow = {
  id: string;
  year: number;
  season: string;
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

function normalizeOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function toTermOption(row: TermRow): TimetableTermOption {
  return {
    id: row.id,
    label: `${row.year} ${formatSeasonLabel(row.season)}`,
    year: row.year,
    season: row.season,
    startDate: parseDateAtStartOfDay(row.start_date),
    endDate: parseDateAtStartOfDay(row.end_date),
  };
}

function registerButtonLabel(status: TimetableStatus | null) {
  if (status === 'dropped') return '再登録';
  if (status === 'enrolled' || status === 'planned') return '追加済み';
  return '登録';
}

export default function TimetableAddPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const context = useMemo(
    () => readTimetableAddContext(new URLSearchParams(searchParams?.toString() ?? '')),
    [searchParams],
  );
  const supabase = useMemo(() => createSupabaseClient(), []);
  const typedSupabase = supabase;

  const [searchInput, setSearchInput] = useState(context.query);
  const [selectedTermId, setSelectedTermId] = useState<string | null>(context.termId);
  const [isMetaLoading, setIsMetaLoading] = useState(true);
  const [isResultsLoading, setIsResultsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [results, setResults] = useState<TimetableSearchResult[]>([]);
  const [termOptions, setTermOptions] = useState<TimetableTermOption[]>([]);
  const [timetableConfig, setTimetableConfig] = useState<TimetableConfig>(DEFAULT_GLOBAL_TIMETABLE_CONFIG);
  const [universityName, setUniversityName] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [submittingOfferingId, setSubmittingOfferingId] = useState<string | null>(null);

  useEffect(() => {
    setSearchInput(context.query);
    setSelectedTermId(context.termId);
  }, [context.query, context.termId]);

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
          console.error('[TimetableAddPage] 時間割設定の取得に失敗しました。デフォルトを適用します:', error);
          return { config: DEFAULT_GLOBAL_TIMETABLE_CONFIG };
        });

        const termsPromise = profile?.university_id
          ? supabase
              .from('terms')
              .select('id, year, season, start_date, end_date')
              .eq('university_id', profile.university_id)
          : Promise.resolve({ data: [] as TermRow[], error: null });

        const [configResult, termsResult] = await Promise.all([configPromise, termsPromise]);

        if (termsResult.error) {
          throw termsResult.error;
        }

        if (cancelled) return;

        const nextTerms = sortTermsDescending(((termsResult.data ?? []) as TermRow[]).map(toTermOption));
        setUniversityName(university?.name ?? null);
        setTermOptions(nextTerms);
        setTimetableConfig(configResult.config);

        if (!context.termId && nextTerms.length > 0) {
          const currentTerm = resolveCurrentTerm(nextTerms, new Date());
          const nextTermId = currentTerm?.id ?? nextTerms[0]?.id ?? null;
          if (nextTermId) {
            setSelectedTermId(nextTermId);
            router.replace(
              buildTimetableAddHref({
                termId: nextTermId,
                dayOfWeek: context.dayOfWeek,
                period: context.period,
                query: context.query,
                returnTo: context.returnTo,
              }),
            );
          }
        }
      } catch (error) {
        console.error('[TimetableAddPage] 初期化エラー:', error);
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
  }, [context.dayOfWeek, context.period, context.query, context.returnTo, context.termId, router, supabase, typedSupabase]);

  useEffect(() => {
    let cancelled = false;

    const fetchResults = async () => {
      if (!selectedTermId) {
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
          _term_id: selectedTermId,
          _day_of_week: context.dayOfWeek,
          _period: context.period,
          _query: context.query.trim() || null,
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
        console.error('[TimetableAddPage] 検索エラー:', error);
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

    void fetchResults();

    return () => {
      cancelled = true;
    };
  }, [context.dayOfWeek, context.period, context.query, selectedTermId, supabase]);

  const selectedTerm = useMemo(
    () => termOptions.find((term) => term.id === selectedTermId) ?? resolveCurrentTerm(termOptions, new Date()),
    [selectedTermId, termOptions],
  );

  const safePeriodOptions = useMemo(() => {
    const options = timetableConfig.periods.map((period) => ({ period: period.period, label: period.label }));
    if (!context.period || options.some((option) => option.period === context.period)) {
      return options;
    }

    return [...options, { period: context.period, label: `${context.period}限` }].sort((left, right) => left.period - right.period);
  }, [context.period, timetableConfig.periods]);

  const contextLabel =
    context.dayOfWeek && context.period
      ? `${formatWeekdayLabel(context.dayOfWeek)}曜 ${context.period}限`
      : selectedTerm?.label ?? '授業検索';

  const replaceRoute = (next: { termId?: string | null; query?: string | null }) => {
    router.replace(
      buildTimetableAddHref({
        termId: next.termId ?? selectedTermId,
        dayOfWeek: context.dayOfWeek,
        period: context.period,
        query: next.query ?? context.query,
        returnTo: context.returnTo,
      }),
    );
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    replaceRoute({ query: searchInput.trim() });
  };

  const isSlotInConfig = (dayOfWeek: TimetableWeekday | null, period: number | null) => {
    if (!dayOfWeek || !period) return false;
    return timetableConfig.weekdays.includes(dayOfWeek) && timetableConfig.periods.some((entry) => entry.period === period);
  };

  const finalizeAndReturn = (value: { offeringId: string; dayOfWeek: TimetableWeekday | null; period: number | null }) => {
    persistTimetableReturnHighlight({
      offeringId: value.offeringId,
      dayOfWeek: value.dayOfWeek,
      period: value.period,
      outOfConfig: !isSlotInConfig(value.dayOfWeek, value.period),
    });
    router.replace(context.returnTo);
  };

  const handleRegister = async (result: TimetableSearchResult) => {
    if (submittingOfferingId || result.myStatus === 'enrolled' || result.myStatus === 'planned' || !selectedTermId) {
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

      toast.success(mutation.wasReactivated ? '時間割に再登録しました' : '時間割に追加しました');
      finalizeAndReturn({
        offeringId: result.offeringId,
        dayOfWeek: context.dayOfWeek ?? result.slotDetails[0]?.dayOfWeek ?? null,
        period: context.period ?? result.slotDetails[0]?.period ?? null,
      });
    } finally {
      setSubmittingOfferingId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <section className="rounded-3xl border border-white/50 bg-white/80 p-6 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => router.replace(context.returnTo)}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              時間割へ戻る
            </button>
            <h1 className="mt-3 text-2xl font-bold text-slate-900">{contextLabel} の授業を追加</h1>
            <p className="mt-2 text-sm text-slate-600">
              大学: {universityName ?? '未設定'} / 学期: {selectedTerm?.label ?? '未設定'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            disabled={!selectedTermId || isMetaLoading}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />＋ 新規作成
          </button>
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
              value={selectedTermId ?? ''}
              onChange={(event) => {
                const nextTermId = event.target.value || null;
                setSelectedTermId(nextTermId);
                replaceRoute({ termId: nextTermId });
              }}
              className="w-full bg-transparent text-sm focus:outline-none"
            >
              <option value="">選択してください</option>
              {termOptions.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.label}
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
          {selectedTermId ? (
            <>
              {context.dayOfWeek && context.period ? (
                <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-sm text-blue-900">
                  {formatWeekdayLabel(context.dayOfWeek)}曜 {context.period}限 に一致する授業を優先表示しています。
                </div>
              ) : null}

              {isResultsLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                  候補を読み込み中...
                </div>
              ) : null}

              {!isResultsLoading && results.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
                  条件に一致する授業が見つかりません。新規作成を使って登録できます。
                </div>
              ) : null}

              {!isResultsLoading ? (
                <div className="space-y-3">
                  {results.map((result) => {
                    const isAlreadyAdded = result.myStatus === 'enrolled' || result.myStatus === 'planned';
                    return (
                      <article
                        key={result.offeringId}
                        className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-lg font-bold text-slate-900">{result.courseTitle}</h2>
                            {result.slotMatch ? (
                              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                                このコマに一致
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                            <span>{result.instructorName ?? '教員未設定'}</span>
                            <span>{result.room ?? '教室未設定'}</span>
                            <span>{result.enrollmentCount}人が登録</span>
                          </div>
                          <p className="mt-2 text-sm text-slate-500">{result.slotLabels.join(' / ') || '曜日・時限未設定'}</p>
                        </div>

                        <button
                          type="button"
                          disabled={!selectedTermId || isAlreadyAdded || submittingOfferingId !== null}
                          onClick={() => void handleRegister(result)}
                          className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-blue-500 px-6 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          {submittingOfferingId === result.offeringId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            registerButtonLabel(result.myStatus)
                          )}
                        </button>
                      </article>
                    );
                  })}
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
              学期データが未設定のため検索・登録を開始できません。
            </div>
          )}
        </section>
      ) : null}

      <CreateOfferingModal
        isOpen={isCreateModalOpen}
        universityName={universityName}
        periodOptions={safePeriodOptions}
        termOptions={termOptions}
        initialTermId={selectedTermId}
        initialDayOfWeek={context.dayOfWeek}
        initialPeriod={context.period}
        onClose={() => setIsCreateModalOpen(false)}
        onComplete={(value) => {
          setIsCreateModalOpen(false);
          finalizeAndReturn(value);
        }}
      />
    </div>
  );
}
