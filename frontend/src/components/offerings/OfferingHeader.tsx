'use client';

import { useState, useCallback,useRef } from 'react';
import { Plus, User, Loader2, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import type { OfferingMeta } from '@/types/offering';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import type { TablesInsert } from '@/types/supabase';

// エラー型の定義
type SupabaseError = {
  code?: string;
  message: string;
};

// 登録用の型
type EnrollmentInsert = TablesInsert<'enrollments'>;

type OfferingHeaderProps = {
  offeringId: string;
  offering: OfferingMeta;
  canEnroll: boolean;
  isEnrolledInitial: boolean;
};

// カスタムフック：登録処理を分離
function useEnrollment(
  offeringId: string,
  isEnrolledInitial: boolean,
  onSuccess?: () => void
) {
  const [isEnrolled, setIsEnrolled] = useState(isEnrolledInitial);
  const isSubmittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);


  const enroll = useCallback(async () => {
    if (isSubmittingRef.current) {
    return { success: false, error: 'Already submitting' };
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      // ユーザー認証確認
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError) {
        throw new Error('認証情報の取得に失敗しました');
      }

      if (!user) {
        return { success: false, error: 'ログインが必要です', requiresAuth: true };
      }

      // 登録処理
      const enrollmentData: EnrollmentInsert = {
        user_id: user.id,
        offering_id: offeringId,
        status: 'enrolled',
        visibility: 'match_only',
      };

      const enrollmentsTable = supabase.from('enrollments') as unknown as {
        insert: (values: EnrollmentInsert) => Promise<{ error: SupabaseError | null }>;
      };

      const { error } = await enrollmentsTable.insert(enrollmentData);

      if (error) {
        // 重複登録の場合は成功として扱う
        if (error.code === '23505') {
          setIsEnrolled(true);
          return { success: true, alreadyEnrolled: true };
        }
        throw error;
      }

      setIsEnrolled(true);
      onSuccess?.();
      return { success: true };

    } catch (err) {
      const error = err as SupabaseError;
      return { 
        success: false, 
        error: error.message || '時間割への追加に失敗しました' 
      };
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [offeringId, onSuccess]);

  return { isEnrolled, isSubmitting, enroll, setIsEnrolled };
}

// カスタムコンポーネント：時間割ヘッダー
export default function OfferingHeader({
  offeringId,
  offering,
  canEnroll,
  isEnrolledInitial,
}: OfferingHeaderProps) {
  const router = useRouter();
  
  const handleSuccess = useCallback(() => {
    router.refresh();
  }, [router]);

  const { isEnrolled, isSubmitting, enroll } = useEnrollment(
    offeringId,
    isEnrolledInitial,
    handleSuccess
  );

  const handleEnroll = useCallback(async () => {
    if (!canEnroll || isEnrolled) return;

    const result = await enroll();

    if (result.requiresAuth) {
      toast.error('ログインが必要です');
      return;
    }

    if (result.success) {
      if (result.alreadyEnrolled) {
        toast.success('すでに追加済みです');
      } else {
        toast.success('時間割に追加しました');
      }
    } else {
      toast.error(result.error || '時間割への追加に失敗しました');
    }
  }, [canEnroll, isEnrolled, enroll]);

  const isDisabled = !canEnroll || isEnrolled || isSubmitting;

  // ボタンの表示状態を決定
  const getButtonContent = () => {
    if (isSubmitting) {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          追加中...
        </>
      );
    }
    
    if (isEnrolled) {
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
        {/* コース情報 */}
        <div className="space-y-3">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            {offering.courseTitle}
          </h1>
          
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <Tag icon={<User className="h-3.5 w-3.5" />}>
              {offering.instructorName ?? '未設定'}
            </Tag>
            <Tag>{offering.termLabel}</Tag>
            <Tag>{offering.timeslotLabel}</Tag>
            {offering.courseCode && <Tag>{offering.courseCode}</Tag>}
          </div>
        </div>

        {/* 登録ボタン */}
        <button
          type="button"
          disabled={isDisabled}
          onClick={handleEnroll}
          aria-busy={isSubmitting}
          aria-label={isEnrolled ? '追加済み' : '時間割に追加'}
          className={`
            inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 
            text-sm font-semibold shadow-sm transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            ${isEnrolled 
              ? 'bg-green-500 text-white hover:bg-green-600' 
              : 'bg-blue-500 text-white hover:bg-blue-400 hover:shadow-md active:scale-95'
            }
            disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none disabled:active:scale-100
          `}
        >
          {getButtonContent()}
        </button>
      </div>
      
      <div className="h-px bg-slate-100" />
    </section>
  );
}

// 補助コンポーネント：タグ
function Tag({ 
  children, 
  icon 
}: { 
  children: React.ReactNode; //必須タグの中に入る JSX / テキスト / 数値 などを受け取れる型
  icon?: React.ReactNode 
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1">
      {icon}
      {children}
    </span>
  );
}
