'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ArrowRight, CalendarDays, MessageSquareText, NotebookPen, Users } from 'lucide-react';
import BrandLogo from '@/components/branding/BrandLogo';

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading, signInWithGoogle } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/home');
    }
  }, [isLoading, user, router]);

  if (!isLoading && user) {
    return null;
  }

  const handleSignIn = async () => {
    try {
      setIsSigningIn(true);
      await signInWithGoogle();
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe_0%,_#f8fafc_45%,_#f8fafc_100%)]">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm backdrop-blur sm:px-6">
          <BrandLogo
            href="/"
            iconSize={40}
            priority
            textClassName="text-2xl font-black tracking-tight text-slate-900"
          />
          <div className="flex items-center gap-2">
            <Link
              href="/home"
              className="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              アプリを見る
            </Link>
            <button
              type="button"
              onClick={handleSignIn}
              disabled={isLoading || isSigningIn}
              className="inline-flex items-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading || isSigningIn ? 'ログイン中...' : 'Googleでログイン'}
            </button>
          </div>
        </header>

        <section className="relative mt-6 overflow-hidden rounded-3xl border border-white/70 bg-white/75 p-6 shadow-sm backdrop-blur sm:p-10">
          <div className="pointer-events-none absolute -top-24 -right-16 h-52 w-52 rounded-full bg-blue-200/70 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-12 h-44 w-44 rounded-full bg-cyan-100 blur-3xl" />

          <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold tracking-wide text-blue-700">
                UNIVERSITY LIFE PLATFORM
              </p>
              <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
                時間割からつながる、
                <br />
                大学生の生活基盤アプリ
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                StudyShareは、時間割・授業情報・口コミ・ノート・コミュニティを横断して使える学生向けプラットフォームです。
                授業ベースで情報がまとまり、同じ大学の学生とつながれます。
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleSignIn}
                  disabled={isLoading || isSigningIn}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isLoading || isSigningIn ? 'ログイン中...' : 'Googleで始める'}
                  <ArrowRight className="h-4 w-4" />
                </button>
                <Link
                  href="/home"
                  className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  ホームを見る
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  title: '時間割',
                  description: '週次の授業を一元管理',
                  icon: CalendarDays,
                  tone: 'bg-blue-50 text-blue-700 border-blue-100',
                },
                {
                  title: '授業・口コミ',
                  description: '授業単位で評判を確認',
                  icon: MessageSquareText,
                  tone: 'bg-emerald-50 text-emerald-700 border-emerald-100',
                },
                {
                  title: 'ノート',
                  description: '授業に紐づくノート共有',
                  icon: NotebookPen,
                  tone: 'bg-amber-50 text-amber-700 border-amber-100',
                },
                {
                  title: 'コミュニティ',
                  description: '時間割ベースでマッチング',
                  icon: Users,
                  tone: 'bg-violet-50 text-violet-700 border-violet-100',
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.title} className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm">
                    <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${item.tone}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h2 className="mt-3 text-sm font-bold text-slate-900">{item.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
