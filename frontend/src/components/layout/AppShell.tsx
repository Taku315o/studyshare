'use client';

import { ReactNode, useState } from 'react';
import { X } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';

type AppShellProps = {
  children: ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <div className="hidden w-64 shrink-0 md:block">
          <div className="sticky top-0 h-screen">
            <Sidebar />
          </div>
        </div>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <TopBar onOpenMobileMenu={() => setIsMobileSidebarOpen(true)} />
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>

      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setIsMobileSidebarOpen(false)}
            aria-label="ナビゲーションを閉じる"
          />

          <div className="relative h-full w-72 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
              <span className="text-sm font-semibold text-slate-500">MENU</span>
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(false)}
                className="rounded-lg p-1 text-slate-600 hover:bg-slate-100"
                aria-label="閉じる"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <Sidebar onNavigate={() => setIsMobileSidebarOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
