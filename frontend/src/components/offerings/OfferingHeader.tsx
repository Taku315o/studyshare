'use client';

import { useState } from 'react';
import { Plus, User } from 'lucide-react';
import toast from 'react-hot-toast';
import type { OfferingMeta } from '@/types/offering';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';

type EnrollmentWriteClient = {
  from: (table: 'enrollments') => {
    insert: (payload: Record<string, unknown>) => Promise<{ error: { code?: string; message?: string } | null }>;
  };
};

type OfferingHeaderProps = {
  offeringId: string;
  offering: OfferingMeta;
  canEnroll: boolean;
  isEnrolledInitial: boolean;
};

export default function OfferingHeader({
  offeringId,
  offering,
  canEnroll,
  isEnrolledInitial,
}: OfferingHeaderProps) {
  const router = useRouter();
  const [isEnrolled, setIsEnrolled] = useState(isEnrolledInitial);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const enrollmentClient = supabase as unknown as EnrollmentWriteClient;

  const handleEnroll = async () => {
    if (!canEnroll || isEnrolled || isSubmitting) return;
    setIsSubmitting(true);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setIsSubmitting(false);
      toast.error('ログインが必要です');
      return;
    }

    const result = await enrollmentClient.from('enrollments').insert({
      user_id: user.id,
      offering_id: offeringId,
      status: 'enrolled',
      visibility: 'match_only',
    });
    setIsSubmitting(false);

    if (!result.error) {
      setIsEnrolled(true);
      toast.success('時間割に追加しました');
      router.refresh();
      return;
    }

    if (result.error.code === '23505') {
      setIsEnrolled(true);
      toast.success('すでに追加済みです');
      return;
    }

    toast.error(result.error.message ?? '時間割への追加に失敗しました');
  };

  return (
    <section className="overflow-hidden rounded-t-3xl bg-white/85 backdrop-blur">
      <div className="flex flex-col gap-4 px-6 pb-5 pt-6 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">{offering.courseTitle}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
              <User className="h-3.5 w-3.5" />
              {offering.instructorName ?? '未設定'}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1">{offering.termLabel}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1">{offering.timeslotLabel}</span>
            {offering.courseCode && <span className="rounded-full bg-slate-100 px-3 py-1">{offering.courseCode}</span>}
          </div>
        </div>

        <button
          type="button"
          disabled={!canEnroll || isEnrolled || isSubmitting}
          onClick={handleEnroll}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Plus className="h-4 w-4" />
          {isEnrolled ? '追加済み' : '時間割に追加'}
        </button>
      </div>
      <div className="h-px bg-slate-100" />
    </section>
  );
}
