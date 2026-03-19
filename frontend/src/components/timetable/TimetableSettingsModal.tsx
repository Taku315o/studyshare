'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import {
  formatWeekdayLabel,
  timetableConfigSchema,
} from '@/lib/timetable/config';
import type { TimetableConfig, TimetablePeriodConfig, TimetableWeekday } from '@/types/timetable';

type TimetableSettingsModalProps = {
  isOpen: boolean;
  title: string;
  description?: string;
  saveLabel?: string;
  isSaving?: boolean;
  initialConfig: TimetableConfig;
  onClose: () => void;
  onSave: (config: TimetableConfig) => Promise<void> | void;
};

const WEEKDAY_OPTIONS: TimetableWeekday[] = [1, 2, 3, 4, 5, 6, 7];

function sortPeriods(periods: TimetablePeriodConfig[]): TimetablePeriodConfig[] {
  return [...periods].sort((left, right) => left.period - right.period);
}

export default function TimetableSettingsModal({
  isOpen,
  title,
  description,
  saveLabel = '保存',
  isSaving = false,
  initialConfig,
  onClose,
  onSave,
}: TimetableSettingsModalProps) {
  const [weekdays, setWeekdays] = useState<TimetableWeekday[]>(initialConfig.weekdays);
  const [periods, setPeriods] = useState<TimetablePeriodConfig[]>(sortPeriods(initialConfig.periods));

  useEffect(() => {
    if (!isOpen) return;
    setWeekdays(initialConfig.weekdays);
    setPeriods(sortPeriods(initialConfig.periods));
  }, [isOpen, initialConfig]);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const sortedWeekdays = useMemo(() => [...weekdays].sort((left, right) => left - right), [weekdays]);

  const handleToggleWeekday = (weekday: TimetableWeekday, checked: boolean) => {
    if (checked) {
      setWeekdays((current) => (current.includes(weekday) ? current : [...current, weekday]));
      return;
    }
    setWeekdays((current) => current.filter((item) => item !== weekday));
  };

  const handlePeriodChange = (
    periodNumber: number,
    field: 'label' | 'startTime' | 'endTime',
    value: string,
  ) => {
    setPeriods((current) =>
      current.map((period) =>
        period.period === periodNumber
          ? {
              ...period,
              [field]: value,
            }
          : period,
      ),
    );
  };

  const handleSave = async () => {
    const validation = timetableConfigSchema.safeParse({ weekdays: sortedWeekdays, periods });
    if (!validation.success) {
      toast.error('時間割の入力内容を確認してください');
      return;
    }

    await onSave({
      weekdays: validation.data.weekdays as TimetableWeekday[],
      periods: sortPeriods(validation.data.periods),
    });
  };

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 p-4"
      data-testid="timetable-settings-modal-overlay"
      onClick={(event) => {
        if (event.target !== event.currentTarget || isSaving) {
          return;
        }
        onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-2xl rounded-2xl border border-white/60 bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}

        <section className="mt-5">
          <p className="text-sm font-semibold text-slate-800">曜日</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {WEEKDAY_OPTIONS.map((weekday) => (
              <label
                key={weekday}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  checked={weekdays.includes(weekday)}
                  onChange={(event) => handleToggleWeekday(weekday, event.target.checked)}
                  disabled={isSaving}
                  className="h-4 w-4 rounded border-slate-300"
                />
                {formatWeekdayLabel(weekday)}
              </label>
            ))}
          </div>
        </section>

        <section className="mt-5">
          <p className="text-sm font-semibold text-slate-800">時限</p>
          <p className="mt-1 text-xs text-slate-500">現在の時間割に含まれる時限だけ編集できます。表示名と時間を変更できます。</p>
          <div className="mt-2 space-y-2">
            {periods.map((period) => (
              <div key={period.period} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-[80px_1fr_140px_140px]">
                <div className="rounded-lg bg-slate-100 px-3 py-2 text-center text-sm font-semibold text-slate-700">
                  {period.period}限
                </div>
                <input
                  type="text"
                  value={period.label}
                  onChange={(event) => handlePeriodChange(period.period, 'label', event.target.value)}
                  disabled={isSaving}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                  aria-label={`${period.period}限の表示名`}
                />
                <input
                  type="time"
                  value={period.startTime}
                  onChange={(event) => handlePeriodChange(period.period, 'startTime', event.target.value)}
                  disabled={isSaving}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                  aria-label={`${period.period}限の開始時刻`}
                />
                <input
                  type="time"
                  value={period.endTime}
                  onChange={(event) => handlePeriodChange(period.period, 'endTime', event.target.value)}
                  disabled={isSaving}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                  aria-label={`${period.period}限の終了時刻`}
                />
              </div>
            ))}
          </div>
        </section>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => {
              void handleSave();
            }}
            disabled={isSaving}
            className="rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSaving ? '保存中...' : saveLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
