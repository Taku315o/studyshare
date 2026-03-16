'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Plus, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { createSupabaseClient } from '@/lib/supabase/client';
import { upsertEnrollment } from '@/lib/timetable/enrollment';
import { mapDuplicateCandidateRow } from '@/lib/timetable/search';
import { buildTermLabel } from '@/lib/timetable/terms';
import { createOfferingSchema, getOfferingValidationErrorMessage } from '@/lib/validation/offering';
import { formatWeekdayLabel } from '@/lib/timetable/config';
import type {
  OfferingCatalogCoverage,
  TimetableDuplicateCandidate,
  TimetableStatus,
  TimetableTermOption,
  TimetableWeekday,
} from '@/types/timetable';

type CreateOfferingModalProps = {
  isOpen: boolean;
  universityName: string | null;
  periodOptions: Array<{ period: number; label: string }>;
  termOptions: TimetableTermOption[];
  initialTermId: string | null;
  initialDayOfWeek: TimetableWeekday | null;
  initialPeriod: number | null;
  catalogCoverage: OfferingCatalogCoverage | null;
  onClose: () => void;
  onComplete: (value: { offeringId: string; dayOfWeek: TimetableWeekday | null; period: number | null }) => void;
};

type DuplicateRpcRow = {
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
  candidate_kind: string | null;
  reasons: string[] | null;
};

type CreateRpcRow = {
  offering_id: string;
  day_of_week: number | null;
  period: number | null;
  status: TimetableStatus;
};

type FormState = {
  termId: string;
  courseTitle: string;
  courseCode: string;
  dayOfWeek: string;
  period: string;
  instructorName: string;
  instructorUnknown: boolean;
  room: string;
  roomUnknown: boolean;
};

const WEEKDAY_OPTIONS: TimetableWeekday[] = [1, 2, 3, 4, 5, 6, 7];

function buildInitialState(args: {
  initialTermId: string | null;
  initialDayOfWeek: TimetableWeekday | null;
  initialPeriod: number | null;
}): FormState {
  return {
    termId: args.initialTermId ?? '',
    courseTitle: '',
    courseCode: '',
    dayOfWeek: args.initialDayOfWeek ? String(args.initialDayOfWeek) : '',
    period: args.initialPeriod ? String(args.initialPeriod) : '',
    instructorName: '',
    instructorUnknown: false,
    room: '',
    roomUnknown: false,
  };
}

function isBlockingCandidate(candidate: TimetableDuplicateCandidate) {
  return candidate.candidateKind === 'exact' || candidate.candidateKind === 'strong';
}

function candidateActionLabel(status: TimetableStatus | null) {
  if (status === 'dropped') return '再登録';
  if (status === 'enrolled' || status === 'planned') return '追加済み';
  return '登録';
}

export default function CreateOfferingModal({
  isOpen,
  universityName,
  periodOptions,
  termOptions,
  initialTermId,
  initialDayOfWeek,
  initialPeriod,
  catalogCoverage,
  onClose,
  onComplete,
}: CreateOfferingModalProps) {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const [form, setForm] = useState<FormState>(() =>
    buildInitialState({ initialTermId, initialDayOfWeek, initialPeriod }),
  );
  const [candidates, setCandidates] = useState<TimetableDuplicateCandidate[]>([]);
  const [isCheckingCandidates, setIsCheckingCandidates] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allowDistinctCreation, setAllowDistinctCreation] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(buildInitialState({ initialTermId, initialDayOfWeek, initialPeriod }));
    setCandidates([]);
    setAllowDistinctCreation(false);
  }, [initialDayOfWeek, initialPeriod, initialTermId, isOpen]);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setAllowDistinctCreation(false);
  }, [form.courseTitle, form.dayOfWeek, form.instructorName, form.instructorUnknown, form.period, form.termId, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const dayOfWeek = Number(form.dayOfWeek);
    const period = Number(form.period);
    const hasRequiredContext =
      form.termId.trim().length > 0 &&
      form.courseTitle.trim().length > 0 &&
      Number.isInteger(dayOfWeek) &&
      dayOfWeek >= 1 &&
      dayOfWeek <= 7 &&
      Number.isInteger(period) &&
      period > 0;

    if (!hasRequiredContext) {
      setCandidates([]);
      setIsCheckingCandidates(false);
      return;
    }

    let cancelled = false;
    setIsCheckingCandidates(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        const rpcClient = supabase as unknown as {
          rpc: (
            fn: 'suggest_offering_duplicates',
            args: {
              _term_id: string;
              _course_title: string;
              _instructor: string | null;
              _day_of_week: number;
              _period: number;
              _limit: number;
            },
          ) => Promise<{ data: DuplicateRpcRow[] | null; error: { message?: string } | null }>;
        };

        const { data, error } = await rpcClient.rpc('suggest_offering_duplicates', {
          _term_id: form.termId,
          _course_title: form.courseTitle.trim(),
          _instructor: form.instructorUnknown ? null : form.instructorName.trim() || null,
          _day_of_week: dayOfWeek,
          _period: period,
          _limit: 8,
        });

        if (error) {
          throw error;
        }

        if (cancelled) return;

        setCandidates(
          (data ?? []).map((row) =>
            mapDuplicateCandidateRow(row, {
              inputTitle: form.courseTitle,
              inputInstructor: form.instructorUnknown ? '' : form.instructorName,
              dayOfWeek: dayOfWeek as TimetableWeekday,
              period,
            }),
          ),
        );
      } catch (error) {
        console.error('[CreateOfferingModal] 重複候補取得エラー:', error);
        if (!cancelled) {
          setCandidates([]);
        }
      } finally {
        if (!cancelled) {
          setIsCheckingCandidates(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    form.courseTitle,
    form.dayOfWeek,
    form.instructorName,
    form.instructorUnknown,
    form.period,
    form.termId,
    isOpen,
    supabase,
  ]);

  if (!isOpen) {
    return null;
  }

  const blockingCandidates = candidates.filter(isBlockingCandidate);
  const selectedDayOfWeek = Number(form.dayOfWeek);
  const selectedPeriod = Number(form.period);
  const isPartialCoverage = catalogCoverage?.coverageKind === 'partial';
  const partialCoveragePreview =
    catalogCoverage && catalogCoverage.sourceScopeLabels.length > 0
      ? catalogCoverage.sourceScopeLabels.slice(0, 3).join('、')
      : null;

  const handleRegisterExisting = async (candidate: TimetableDuplicateCandidate) => {
    if (candidate.myStatus === 'enrolled' || candidate.myStatus === 'planned' || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await upsertEnrollment(supabase, {
        offeringId: candidate.offeringId,
        status: 'enrolled',
      });

      if (!result.success) {
        toast.error(result.error || '時間割への追加に失敗しました');
        return;
      }

      if (result.alreadyActive) {
        toast.success('すでに追加済みです');
        return;
      }

      toast.success(result.wasReactivated ? '時間割に再登録しました' : '時間割に追加しました');
      onComplete({
        offeringId: candidate.offeringId,
        dayOfWeek:
          Number.isInteger(selectedDayOfWeek) && selectedDayOfWeek >= 1 && selectedDayOfWeek <= 7
            ? (selectedDayOfWeek as TimetableWeekday)
            : (candidate.slotDetails[0]?.dayOfWeek ?? null),
        period:
          Number.isInteger(selectedPeriod) && selectedPeriod > 0
            ? selectedPeriod
            : (candidate.slotDetails[0]?.period ?? null),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreate = async () => {
    const validation = createOfferingSchema.safeParse({
      termId: form.termId,
      courseTitle: form.courseTitle,
      courseCode: form.courseCode,
      dayOfWeek: form.dayOfWeek,
      period: form.period,
      instructorName: form.instructorName,
      instructorUnknown: form.instructorUnknown,
      room: form.room,
      roomUnknown: form.roomUnknown,
    });

    if (!validation.success) {
      toast.error(getOfferingValidationErrorMessage(validation.error));
      return;
    }

    if (blockingCandidates.length > 0 && !allowDistinctCreation) {
      toast.error('既存候補を確認してください。別授業として作成する場合は明示的に選択してください。');
      return;
    }

    setIsSubmitting(true);
    try {
      const rpcClient = supabase as unknown as {
        rpc: (
          fn: 'create_offering_and_enroll',
          args: {
            _term_id: string;
            _course_title: string;
            _course_code: string | null;
            _day_of_week: number;
            _period: number;
            _instructor: string | null;
            _room: string | null;
            _confirm_distinct: boolean;
          },
        ) => Promise<{ data: CreateRpcRow[] | null; error: { message?: string } | null }>;
      };

      const { data, error } = await rpcClient.rpc('create_offering_and_enroll', {
        _term_id: validation.data.termId,
        _course_title: validation.data.courseTitle,
        _course_code: validation.data.courseCode.trim() || null,
        _day_of_week: validation.data.dayOfWeek,
        _period: validation.data.period,
        _instructor: validation.data.instructorUnknown ? null : validation.data.instructorName.trim() || null,
        _room: validation.data.roomUnknown ? null : validation.data.room.trim() || null,
        _confirm_distinct: allowDistinctCreation,
      });

      if (error) {
        throw error;
      }

      const row = data?.[0];
      if (!row) {
        toast.error('講義の作成に失敗しました');
        return;
      }

      toast.success('講義を作成して時間割に追加しました');
      onComplete({
        offeringId: row.offering_id,
        dayOfWeek:
          typeof row.day_of_week === 'number' && row.day_of_week >= 1 && row.day_of_week <= 7
            ? (row.day_of_week as TimetableWeekday)
            : null,
        period: typeof row.period === 'number' && row.period > 0 ? row.period : null,
      });
    } catch (error) {
      console.error('[CreateOfferingModal] 作成エラー:', error);
      const message = error instanceof Error ? error.message : '講義の作成に失敗しました';
      if (message.includes('duplicate_candidates_exist')) {
        toast.error('重複候補が見つかりました。既存候補を確認してください。');
      } else {
        toast.error(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">New Offering</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">講義を新規作成</h2>
            <p className="mt-2 text-sm text-slate-600">
              {universityName ?? '大学未設定'} / 学期・曜日・時限を含む最小単位で登録します。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
            aria-label="新規作成モーダルを閉じる"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            {isPartialCoverage ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-semibold">この学期は一部区分のみ収録中です。</p>
                    <p className="mt-1 text-xs text-amber-900">
                      検索で見つからない授業は未収録の可能性があります。重複候補を確認したうえで新規作成してください。
                    </p>
                    {partialCoveragePreview ? (
                      <p className="mt-1 text-xs text-amber-900">現在の収録区分: {partialCoveragePreview}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">学期</span>
                <select
                  value={form.termId}
                  onChange={(event) => setForm((current) => ({ ...current, termId: event.target.value }))}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4"
                >
                  <option value="">選択してください</option>
                  {termOptions.map((term) => (
                    <option key={term.id} value={term.id}>
                      {buildTermLabel(term)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">講義コード</span>
                <input
                  type="text"
                  value={form.courseCode}
                  onChange={(event) => setForm((current) => ({ ...current, courseCode: event.target.value }))}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4"
                  placeholder="任意"
                />
              </label>
            </div>

            <label className="block space-y-2 text-sm text-slate-700">
              <span className="font-medium">講義名</span>
              <input
                type="text"
                value={form.courseTitle}
                onChange={(event) => setForm((current) => ({ ...current, courseTitle: event.target.value }))}
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4"
                placeholder="マーケティング"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">曜日</span>
                <select
                  value={form.dayOfWeek}
                  onChange={(event) => setForm((current) => ({ ...current, dayOfWeek: event.target.value }))}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4"
                >
                  <option value="">選択してください</option>
                  {WEEKDAY_OPTIONS.map((weekday) => (
                    <option key={weekday} value={weekday}>
                      {formatWeekdayLabel(weekday)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">時限</span>
                <select
                  value={form.period}
                  onChange={(event) => setForm((current) => ({ ...current, period: event.target.value }))}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4"
                >
                  <option value="">選択してください</option>
                  {periodOptions.map((periodOption) => (
                    <option key={periodOption.period} value={periodOption.period}>
                      {periodOption.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">教員名</span>
                <input
                  type="text"
                  value={form.instructorName}
                  onChange={(event) => setForm((current) => ({ ...current, instructorName: event.target.value }))}
                  disabled={form.instructorUnknown}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 disabled:bg-slate-100"
                  placeholder="大崎恒次"
                />
                <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={form.instructorUnknown}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        instructorUnknown: event.target.checked,
                        instructorName: event.target.checked ? '' : current.instructorName,
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-blue-500"
                  />
                  教員不明
                </label>
              </div>

              <div className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">教室</span>
                <input
                  type="text"
                  value={form.room}
                  onChange={(event) => setForm((current) => ({ ...current, room: event.target.value }))}
                  disabled={form.roomUnknown}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 disabled:bg-slate-100"
                  placeholder="302"
                />
                <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={form.roomUnknown}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        roomUnknown: event.target.checked,
                        room: event.target.checked ? '' : current.room,
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-blue-500"
                  />
                  教室不明
                </label>
              </div>
            </div>
          </div>

          <aside className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Search className="h-4 w-4 text-blue-500" />
              重複候補
              {isCheckingCandidates ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" /> : null}
            </div>

            {blockingCandidates.length > 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-semibold">同一または強く類似する授業候補があります。</p>
                    <p className="mt-1">まず既存 offering を登録し、別授業として作る場合のみ明示的に override してください。</p>
                  </div>
                </div>
              </div>
            ) : null}

            {candidates.length === 0 && !isCheckingCandidates ? (
              <p className="rounded-2xl border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-500">
                講義名・曜日・時限を入力すると候補を表示します。
              </p>
            ) : null}

            {candidates.length > 0 ? (
              <div className="space-y-3">
                {candidates.map((candidate) => {
                  const isAlreadyAdded = candidate.myStatus === 'enrolled' || candidate.myStatus === 'planned';
                  return (
                    <div key={candidate.offeringId} className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{candidate.courseTitle}</p>
                          <p className="mt-1 text-xs text-slate-600">{candidate.instructorName ?? '教員未設定'}</p>
                        </div>
                        <span
                          className={[
                            'inline-flex rounded-full px-2 py-1 text-[11px] font-semibold',
                            candidate.candidateKind === 'exact'
                              ? 'bg-rose-100 text-rose-700'
                              : candidate.candidateKind === 'strong'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-100 text-slate-600',
                          ].join(' ')}
                        >
                          {candidate.candidateKind}
                        </span>
                      </div>

                      <div className="mt-2 space-y-1 text-xs text-slate-600">
                        <p>{candidate.slotLabels.join(' / ') || '曜日・時限未設定'}</p>
                        <p>教室: {candidate.room ?? '未設定'} / 受講者数: {candidate.enrollmentCount}</p>
                      </div>

                      {candidate.reasons.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {candidate.reasons.map((reason) => (
                            <span key={reason} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                              {reason}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      <button
                        type="button"
                        disabled={isAlreadyAdded || isSubmitting}
                        onClick={() => void handleRegisterExisting(candidate)}
                        className="mt-3 inline-flex items-center gap-1 rounded-full bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {candidateActionLabel(candidate.myStatus)}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {blockingCandidates.length > 0 ? (
              <label className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={allowDistinctCreation}
                  onChange={(event) => setAllowDistinctCreation(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-500"
                />
                <span>候補とは別授業として作成する</span>
              </label>
            ) : null}
          </aside>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
          <p className="text-xs text-slate-500">
            {blockingCandidates.length > 0
              ? '候補があるため、既存登録か distinct override のどちらかを選んでください。'
              : '内容を確認して作成すると、そのまま時間割に登録されます。'}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              閉じる
            </button>
            <button
              type="button"
              disabled={isSubmitting || !form.termId || (blockingCandidates.length > 0 && !allowDistinctCreation)}
              onClick={() => void handleCreate()}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              作成して登録
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
