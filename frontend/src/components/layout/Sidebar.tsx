'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { CalendarDays, Home, MessageSquareText, UserCircle2, Users } from 'lucide-react';

type SidebarProps = {
  onNavigate?: () => void;
};

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
};

const navItems: NavItem[] = [
  { label: 'ホーム', href: '/home', icon: Home },
  { label: '授業・口コミ', href: '/offerings', icon: MessageSquareText },
  { label: '時間割', href: '/timetable', icon: CalendarDays },
  { label: 'コミュニティ', href: '/community', icon: Users },
  { label: 'マイページ', href: '/me', icon: UserCircle2 },
];

export default function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="h-full rounded-3xl border border-white/60 bg-white/75 shadow-sm backdrop-blur">
      <div className="px-5 py-5">
        <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Navigation</p>
      </div>

      <nav className="space-y-1 px-3 pb-6">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          if (item.disabled) {
            return (
              <div
                key={item.href}
                className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-slate-400"
                aria-disabled="true"
                title={`${item.href} (準備中)`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  {item.label}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px]">準備中</span>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={[
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900',
              ].join(' ')}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
