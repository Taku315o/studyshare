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
import Header from '@/components/Header';
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
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container mx-auto px-4 py-8 pt-24">
          <div className="mx-auto max-w-5xl">
            <header className="mb-8 flex items-center gap-3">
              <div className="h-9 w-24 rounded-full bg-white/10" />
              <div className="h-9 w-60 rounded-full bg-white/10" />
            </header>
          </div>
          <main className="relative mx-auto max-w-5xl">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[110%] bg-blue-500/10 blur-[70px] rounded-full pointer-events-none" />
            <div className="relative overflow-hidden rounded-[3rem] border border-white/12 bg-slate-900/35 backdrop-blur-md shadow-xl shadow-black/10">
              <div className="p-6 md:p-10">
                <div className="max-w-2xl mx-auto space-y-6">
                  <div className="h-4 w-24 rounded-full bg-white/10" />
                  <div className="h-11 w-full rounded-2xl bg-white/10" />
                  <div className="h-4 w-24 rounded-full bg-white/10" />
                  <div className="h-28 w-full rounded-2xl bg-white/10" />
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <div className="h-4 w-20 rounded-full bg-white/10" />
                      <div className="h-11 w-full rounded-2xl bg-white/10" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 w-20 rounded-full bg-white/10" />
                      <div className="h-11 w-full rounded-2xl bg-white/10" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 w-20 rounded-full bg-white/10" />
                      <div className="h-11 w-full rounded-2xl bg-white/10" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 w-20 rounded-full bg-white/10" />
                      <div className="h-11 w-full rounded-2xl bg-white/10" />
                    </div>
                  </div>
                  <div className="h-4 w-24 rounded-full bg-white/10" />
                  <div className="h-12 w-full rounded-2xl bg-white/10" />
                </div>
              </div>
              <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_1.6s_infinite]" />
            </div>
          </main>
          <style jsx>{`
            @keyframes shimmer {
              100% {
                transform: translateX(100%);
              }
            }
          `}</style>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // リダイレクト中は何も表示しない
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container mx-auto px-4 py-8 pt-24">
        <div className="mx-auto max-w-5xl">
          <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/"
                className="text-base font-semibold text-white hover:text-white/95 transition-colors"
              >
                <span className="inline-flex items-center rounded-full bg-white/15 px-3.5 py-1.5">
                  ← 戻る
                </span>
              </Link>
              <h1 className="text-3xl font-bold tracking-tight text-white">新しいnoteを投稿</h1>
            </div>
          </header>
        </div>

        <main className="relative mx-auto max-w-5xl">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-blue-500/20 blur-[100px] rounded-full pointer-events-none" />
          <div className="relative overflow-hidden rounded-[3rem] border border-white/10 bg-slate-900/30 backdrop-blur-xl shadow-2xl shadow-black/20">
            <div className="p-6 md:p-10">
              <div className="max-w-2xl mx-auto">
                <AssignmentForm />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
