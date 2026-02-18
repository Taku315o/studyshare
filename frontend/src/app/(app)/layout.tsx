import type { ReactNode } from 'react';
import AppRouteGuard from '@/components/auth/AppRouteGuard';
import AppShell from '@/components/layout/AppShell';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppRouteGuard>
      <AppShell>{children}</AppShell>
    </AppRouteGuard>
  );
}
