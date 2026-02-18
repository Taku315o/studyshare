'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

type AppRouteGuardProps = {
  children: ReactNode;
};

export default function AppRouteGuard({ children }: AppRouteGuardProps) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/');
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-600">
        読み込み中...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
