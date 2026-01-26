'use client';
//use clientを使うことで、このファイルがクライアントサイドで実行される.

//新しい課題を投稿するためのページ
//useAuthフックでユーザーがログインしているかを確認し、ログインしていなければトップページにリダイレクトする。
// ログインしている場合は、課題投稿用のAssignmentFormコンポーネントを表示。
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import AssignmentForm from '@/components/AssignmentForm';
//app/assignments/new/page.tsx に置いてあるこの関数は、URL /assignments/new にアクセスしたときに表示されるページ
/**
 * Page that guards assignment creation behind authentication and renders the submission form for logged-in users.
 *
 * @returns JSX element representing the assignment creation screen or redirects when unauthenticated.
 */
export default function NewAssignmentPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // 未ログインならトップページにリダイレクト
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return <div className="container mx-auto px-4 py-8 text-center">読み込み中...</div>;
  }

  if (!user) {
    return null; // リダイレクト中は何も表示しない
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8 bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-4 rounded-lg shadow flex items-center justify-between">
        <Link href="/" className="hover:underline">
          ← 戻る
        </Link>
        <h1 className="text-2xl font-bold">新しい課題を投稿</h1>
      </header>

      <main>
        <div className="max-w-2xl mx-auto">
          <AssignmentForm />
        </div>
      </main>
    </div>
  );
}