import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Sparkles, ArrowRight } from 'lucide-react';

/**
 * Hero section for the home page that highlights the app value and prompts users to sign in or post assignments.
 *
 * @returns JSX element representing the hero banner.
 */
export default function Hero() {
  const { user, signInWithGoogle } = useAuth();
  return (
    <section className="relative mb-16 pt-10">
      {/* Decorative background elements behind the glass card */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-blue-500/20 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[3rem] border border-white/10 bg-slate-900/30 backdrop-blur-xl shadow-2xl shadow-black/20">
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

        <div className="relative px-8 py-20 text-center md:py-24">
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full bg-white/5 border border-white/10 text-blue-200 text-sm font-medium backdrop-blur-md">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span>Share your knowledge with others</span>
          </div>

          <h2 className="mb-6 text-5xl font-bold tracking-tight text-white md:text-7xl drop-shadow-lg">
            noteを共有して、 <br />
            {/*<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">*/}
            <span className="mb-6 text-5xl font-bold tracking-tight text-white md:text-7xl drop-shadow-lg">
              学びを深めよう
            </span>
          </h2>

          <p className="mb-10 text-lg text-blue-100/80 max-w-2xl mx-auto leading-relaxed">
            StudyShareは大学のnoteをみんなで共有し合うためのプラットフォームです。
          </p>

          <div className="flex justify-center gap-4">
            {user ? (
              <Link
                href="/assignments/new"
                className="group relative px-8 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-1 transition-all duration-300 overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2">
                  ノートを投稿
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-450 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Link>
            ) : (
              <button
                onClick={() => signInWithGoogle()}
                className="group relative px-8 py-4 rounded-2xl bg-white/10 hover:bg-blue-500 text-white font-bold text-lg border border-white/10 backdrop-blur-md transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
              >
                Googleで始める
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
