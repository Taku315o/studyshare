import { Suspense, type ReactNode } from 'react';
import AppRouteGuard from '@/components/auth/AppRouteGuard';
import AppShell from '@/components/layout/AppShell';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-100" />}>
      <AppRouteGuard>
        <AppShell>{children}</AppShell>
      </AppRouteGuard>
    </Suspense>
  );
}
