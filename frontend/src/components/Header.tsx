'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Loader2, LogOut, PenSquare } from 'lucide-react';

export default function Header() {
  const { user, isLoading, signInWithGoogle, signOut } = useAuth();

  return (
    // ① header自体をcontainerに入れて固定。外側divのpy-8を消して「上が空きすぎ問題」を解消
    <header className="fixed top-4 left-0 right-0 z-50">
      <div className="container mx-auto px-4 py-0">
        {/* ② ガラスのルール統一：bg/border/shadowを弱めて読みやすさと品を優先 */}
        <div className="flex items-center justify-between rounded-3xl px-6 py-3 backdrop-blur-2xl bg-white/10 border border-white/15 shadow-md shadow-black/5">
          {/* ③ ロゴ：drop-shadowを弱め、hoverで少しだけ明るく */}
          <Link
            href="/"
            className="text-xl sm:text-2xl font-semibold tracking-tight text-white/95 hover:text-white transition-colors"
          >
            StudyShare
          </Link>

          <div className="flex items-center gap-3 sm:gap-4">
            {isLoading ? (
              // ④ Loading：文言は小さめ・色も控えめに
              <div className="flex items-center text-white/70">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                <span className="text-sm font-medium">Loading...</span>
              </div>
            ) : user ? (
              <>
                {/* ⑤ CTAの色を統一：hoverで青→緑に変わるのをやめて一貫性を出す */}
                <Link
                  href="/assignments/new"
                  className="group inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-blue-500/90 hover:bg-blue-500 text-white font-medium transition-all duration-200 shadow-sm shadow-black/10 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  <PenSquare className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
                  ノートを共有
                </Link>

                {/* ⑥ ログアウト：危険操作なので目立たせすぎず、でも押しやすく（hit area増やす） */}
                <button
                  onClick={() => signOut()}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="hidden sm:inline">ログアウト</span>
                </button>
              </>
            ) : (
              // ⑦ 言語統一：英語→日本語。Googleボタンも主張を適切に
              <button
                onClick={() => signInWithGoogle()}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-medium border border-white/10 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                Googleでログイン
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
