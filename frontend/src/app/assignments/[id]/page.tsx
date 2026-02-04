// studyshare/frontend/src/app/assignments/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import supabase from '@/lib/supabase';

type AssignmentDetail = {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
  user?: {
    email: string;
  };
};

type AssignmentDetailPageProps = {
  params: {
    id: string;
  };
};

/**
 * Displays a single assignment detail page based on the route param.
 *
 * @param params - Route parameters containing the assignment id.
 * @returns JSX element rendering the assignment details.
 */
export default function AssignmentDetailPage({ params }: AssignmentDetailPageProps) {
  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchAssignment = async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const { data, error } = await supabase
          .from('assignments')
          .select(
            `
              *,
              user:user_id (
                email
              )
            `,
          )
          .eq('id', params.id)
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          setAssignment(null);
          setErrorMessage('課題が見つかりませんでした');
          return;
        }

        setAssignment(data);
      } catch (error) {
        console.error('課題詳細の取得エラー:', error);
        setErrorMessage('課題の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchAssignment();
  }, [params.id]);

  if (loading) {
    return <div className="container mx-auto px-4 py-8 text-center">読み込み中...</div>;
  }

  if (!assignment) {
    return (
      <div className="container mx-auto px-4 py-8">
        <header className="mb-6 flex items-center justify-between">
          <Link href="/" className="text-blue-600 hover:underline">
            ← 戻る
          </Link>
        </header>
        <div className="text-center text-gray-600">{errorMessage ?? '課題が見つかりませんでした'}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-blue-600 hover:underline">
          ← 戻る
        </Link>
        <span className="text-sm text-gray-500">
          {new Date(assignment.created_at).toLocaleString('ja-JP')}
        </span>
      </header>

      <main className="max-w-3xl mx-auto">
        <div className="border rounded-lg overflow-hidden shadow-sm bg-white dark:bg-gray-800">
          {assignment.image_url && (
            <div className="w-full h-72 overflow-hidden relative">
              <Image
                src={assignment.image_url}
                alt={assignment.title}
                fill
                className="object-cover"
              />
            </div>
          )}
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {assignment.title}
            </h1>
            <p className="text-gray-700 dark:text-gray-300 mt-4 whitespace-pre-wrap">
              {assignment.description}
            </p>

            <div className="mt-6 text-sm text-gray-500 dark:text-gray-400 flex flex-col gap-1">
              <span>投稿者: {assignment.user?.email || '不明'}</span>
              <span>最終更新: {new Date(assignment.updated_at).toLocaleString('ja-JP')}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
