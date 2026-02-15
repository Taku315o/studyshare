'use client';

import Link from 'next/link';
import { Bell, Menu, Plus, Search } from 'lucide-react';

type TopBarProps = {
  onOpenMobileMenu: () => void;
};

export default function TopBar({ onOpenMobileMenu }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 md:hidden"
          aria-label="ナビゲーションを開く"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Link href="/home" className="text-xl font-bold tracking-tight text-slate-800">
          StudyShare
        </Link>

        <div className="hidden flex-1 items-center lg:flex">
          <label
            className="ml-6 flex h-10 w-full max-w-2xl items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3"
            htmlFor="global-search"
          >
            <Search className="h-4 w-4 text-slate-500" />
            <input
              id="global-search"
              type="text"
              placeholder="授業、教員、キーワードを検索..."
              className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
            />
          </label>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
            aria-label="通知"
          >
            <Bell className="h-5 w-5" />
          </button>

          <Link
            href="/assignments/new"
            className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            <Plus className="h-4 w-4" />
            投稿
          </Link>

          <Link
            href="/profile"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-300"
            aria-label="マイページ"
          >
            U
          </Link>
        </div>
      </div>

      <div className="border-t border-slate-100 px-4 py-3 lg:hidden">
        <label
          className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3"
          htmlFor="global-search-mobile"
        >
          <Search className="h-4 w-4 text-slate-500" />
          <input
            id="global-search-mobile"
            type="text"
            placeholder="授業、教員、キーワードを検索..."
            className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
        </label>
      </div>
    </header>
  );
}
