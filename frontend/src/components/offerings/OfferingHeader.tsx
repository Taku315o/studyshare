'use client';

import type { ReactNode } from 'react';
import { useMemo, useRef, useState } from 'react';
import { Check, Loader2, Plus, RotateCcw, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { createSupabaseClient } from '@/lib/supabase/client';
import { upsertEnrollment } from '@/lib/timetable/enrollment';
import type { OfferingMeta } from '@/types/offering';
import type { TimetableStatus } from '@/types/timetable';

type OfferingHeaderProps = {
  offeringId: string;
  offering: OfferingMeta;
  canEnroll: boolean;
  initialEnrollmentStatus: TimetableStatus | null;
};

function Tag({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1">
      {icon}
      {children}
    </span>
  );
}

export default function OfferingHeader({
  offeringId,
  offering,
  canEnroll,
  initialEnrollmentStatus,
}: OfferingHeaderProps) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseClient(), []);
  const [enrollmentStatus, setEnrollmentStatus] = useState<TimetableStatus | null>(initialEnrollmentStatus);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  const isAlreadyActive = enrollmentStatus === 'enrolled' || enrollmentStatus === 'planned';
  const isReactivatable = enrollmentStatus === 'dropped';

  const handleEnroll = async () => {
    if (!canEnroll || isSubmittingRef.current || (isAlreadyActive && !isReactivatable)) {
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const result = await upsertEnrollment(supabase, {
        offeringId,
        status: 'enrolled',
      });

      if (!result.success) {
        if (result.requiresAuth) {
          toast.error('ログインが必要です');
          return;
        }

        toast.error(result.error || '時間割への追加に失敗しました');
        return;
      }

      setEnrollmentStatus(result.row.status);
      router.refresh();

      if (result.alreadyActive) {
        toast.success('すでに追加済みです');
        return;
      }

      if (result.wasReactivated) {
        toast.success('時間割に再登録しました');
        return;
      }

      toast.success('時間割に追加しました');
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const isDisabled = !canEnroll || isSubmitting || (isAlreadyActive && !isReactivatable);

  const buttonContent = () => {
    if (isSubmitting) {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          登録中...
        </>
      );
    }

    if (isReactivatable) {
      return (
        <>
          <RotateCcw className="h-4 w-4" />
          再登録
        </>
      );
    }

    if (isAlreadyActive) {
      return (
        <>
          <Check className="h-4 w-4" />
          追加済み
        </>
      );
    }

    return (
      <>
        <Plus className="h-4 w-4" />
        時間割に追加
      </>
    );
  };

  return (
    <section className="overflow-hidden rounded-t-3xl bg-white/85 backdrop-blur">
      <div className="flex flex-col gap-4 px-6 pb-5 pt-6 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">{offering.courseTitle}</h1>

          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <Tag icon={<User className="h-3.5 w-3.5" />}>{offering.instructorName ?? '未設定'}</Tag>
            <Tag>{offering.termLabel}</Tag>
            <Tag>{offering.timeslotLabel}</Tag>
            {offering.courseCode ? <Tag>{offering.courseCode}</Tag> : null}
          </div>
        </div>

        <button
          type="button"
          disabled={isDisabled}
          onClick={handleEnroll}
          aria-busy={isSubmitting}
          aria-label={isReactivatable ? '時間割へ再登録' : isAlreadyActive ? '追加済み' : '時間割に追加'}
          className={[
            'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
            isReactivatable
              ? 'bg-amber-500 text-white hover:bg-amber-400'
              : isAlreadyActive
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-blue-500 text-white hover:bg-blue-400 hover:shadow-md active:scale-95',
            'disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none disabled:active:scale-100',
          ].join(' ')}
        >
          {buttonContent()}
        </button>
      </div>

      <div className="h-px bg-slate-100" />
    </section>
  );
}
