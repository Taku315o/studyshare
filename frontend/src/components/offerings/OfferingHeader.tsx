'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import type { OfferingMeta } from '@/types/offering';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';

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

    const result = await supabase.from('enrollments').insert({
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
    <section className="rounded-3xl border border-white/50 bg-white/70 p-6 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Offering Detail</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">{offering.courseTitle}</h1>
          <div className="flex flex-wrap gap-2 text-sm text-slate-600">
            <span className="rounded-full bg-slate-100 px-3 py-1">教員: {offering.instructorName ?? '未設定'}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1">学期: {offering.termLabel}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1">曜日コマ: {offering.timeslotLabel}</span>
            {offering.courseCode && <span className="rounded-full bg-slate-100 px-3 py-1">{offering.courseCode}</span>}
          </div>
        </div>

        <button
          type="button"
          disabled={!canEnroll || isEnrolled || isSubmitting}
          onClick={handleEnroll}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Plus className="h-4 w-4" />
          {isEnrolled ? '追加済み' : '時間割に追加'}
        </button>
      </div>
    </section>
  );
}
