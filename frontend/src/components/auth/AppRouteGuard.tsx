'use client';

import { ReactNode, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import supabase from '@/lib/supabase';

type AppRouteGuardProps = {
  children: ReactNode;
};

type ProfileCompletionRow = {
  university_id: string | null;
  grade_year: number | null;
};

export default function AppRouteGuard({ children }: AppRouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();
  const [isProfileCheckLoading, setIsProfileCheckLoading] = useState(false);
  const [isProfileComplete, setIsProfileComplete] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/');
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      setIsProfileCheckLoading(false);
      setIsProfileComplete(null);
      return;
    }

    let isMounted = true;

    const checkProfileCompletion = async () => {
      setIsProfileCheckLoading(true);

      const { data, error } = await supabase
        .from('profiles')
        .select('university_id, grade_year')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (error) {
        console.error('プロフィール完了判定に失敗しました:', error);
        setIsProfileComplete(true);
        setIsProfileCheckLoading(false);
        return;
      }

      const profile = data as ProfileCompletionRow | null;
      const completed = Boolean(profile?.university_id && profile?.grade_year);
      setIsProfileComplete(completed);
      setIsProfileCheckLoading(false);

      const currentQuery = searchParams?.toString();
      const currentPathWithQuery = currentQuery ? `${pathname}?${currentQuery}` : pathname;

      if (!completed && pathname !== '/onboarding') {
        router.replace(`/onboarding?next=${encodeURIComponent(currentPathWithQuery)}`);
        return;
      }

      if (completed && pathname === '/onboarding') {
        const nextPath = searchParams?.get('next');
        const safeNextPath = nextPath && nextPath !== '/onboarding' ? nextPath : '/home';
        router.replace(safeNextPath);
      }
    };

    void checkProfileCompletion();

    return () => {
      isMounted = false;
    };
  }, [isLoading, user, pathname, searchParams, router]);

  if (isLoading || (user && isProfileCheckLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-600">
        読み込み中...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (pathname !== '/onboarding' && isProfileComplete === false) {
    return null;
  }

  return <>{children}</>;
}
