"use client";


//AuthContext.tsx
// ユーザー認証状態を管理し、アプリケーション全体で共有するためのContextとProvider
//ユーザー情報（user）、セッション（session）、プロフィール（profile）などを、アプリ内のどのコンポーネントからでも直接呼び出せるようにします。
// Googleログインやログアウトの関数もここで定義されています。
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import supabase from '@/lib/supabase';
import type { Database } from '@/types/supabase';
import { setAuthToken } from '@/lib/api';//401 はバックエンドが認証トークンを受け取れていない可能性が高いので、セッション変更時に必ず Authorization を同期するように修正しました。
import { useRouter } from 'next/navigation';//Next.js 13+ の App Router で使用されるライブラリでページ遷移やURL操作を扱うためのフックや関数

type ProfileRow = Pick<Database['public']['Tables']['profiles']['Row'], 'user_id' | 'display_name'>;

type UserProfile = {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  role: 'student' | 'admin' | 'moderator';
};

type AuthContextType = {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getAuthErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return '';
}

function isRecoverableAuthError(error: unknown): boolean {
  const normalizedMessage = getAuthErrorMessage(error).toLowerCase();

  return (
    normalizedMessage.includes('invalid refresh token')
    || normalizedMessage.includes('refresh token not found')
    || normalizedMessage.includes('refresh_token_not_found')
    || normalizedMessage.includes('session from session_id claim in jwt does not exist')
  );
}

/**
 * Provides authentication context to descendant components, wiring Supabase session management and helper actions.
 *
 * @param children - React nodes that should have access to authentication state and actions.
 * @returns JSX element that renders the context provider around the supplied children.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const getRoleFromUser = useCallback((currentUser: User): UserProfile['role'] => {
    const role = currentUser.app_metadata?.role;
    if (role === 'admin' || role === 'moderator') {
      return role;
    }
    return 'student';
  }, []);

  const resetAuthState = useCallback(() => {
    setSession(null);
    setUser(null);
    setProfile(null);
    setAuthToken(null);
  }, []);

  const clearBrokenSession = useCallback(async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Invalid refresh tokens are expected here; keep the client signed out locally.
    } finally {
      resetAuthState();
    }
  }, [resetAuthState]);

  const fetchProfile = useCallback(async (currentUser: User) => {
    const { data: profileDataRaw, error: profileError } = await supabase
      .from('profiles')
      .select('user_id,display_name')
      .eq('user_id', currentUser.id)
      .single();

    const profileData = profileDataRaw as ProfileRow | null;

    if (profileError) {
      console.error('プロフィール取得エラー:', profileError);
    }

    if (profileData) {
      const mappedProfile: UserProfile = {
        id: profileData.user_id,
        user_id: profileData.user_id,
        display_name: profileData.display_name,
        email: currentUser.email ?? '',
        role: getRoleFromUser(currentUser),
      };
      setProfile(mappedProfile);
      return;
    }

    setProfile({
      id: currentUser.id,
      user_id: currentUser.id,
      display_name: currentUser.user_metadata?.name ?? currentUser.email ?? 'user',
      email: currentUser.email ?? '',
      role: getRoleFromUser(currentUser),
    });
  }, [getRoleFromUser]);

  // セッション初期化
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          if (isRecoverableAuthError(error)) {
            await clearBrokenSession();
            return;
          }
          console.error('セッション取得エラー:', error);
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        setAuthToken(session?.access_token ?? null);

        if (session?.user) {
          const { error: userError } = await supabase.auth.getUser();
          if (userError) {
            if (isRecoverableAuthError(userError)) {
              await clearBrokenSession();
              return;
            }
            console.error('セッション検証エラー:', userError);
            await clearBrokenSession();
            return;
          }

          await fetchProfile(session.user);
        }
      } catch (error) {
        if (isRecoverableAuthError(error)) {
          await clearBrokenSession();
          return;
        }
        console.error('セッション初期化エラー:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setAuthToken(session?.access_token ?? null);
        
        if (session?.user) {
          await fetchProfile(session.user);
        } else {
          setProfile(null);
        }
        
        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [clearBrokenSession, fetchProfile]);

  // Googleログイン
  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      
      if (error) throw error;
    } catch (error) {
      console.error('Google認証エラー:', error);
      throw error;
    }
  };

  // ログアウト
  const signOut = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      console.error('ログアウトエラー:', error);
    } finally {
      setSession(null);
      setUser(null);
      setProfile(null);
      setAuthToken(null);
      router.push('/');
    }
  };

  // JWTトークン取得（常にSupabaseから最新を取得）
  const getAccessToken = async (): Promise<string | null> => {
    try {
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();
      if (error) {
        if (isRecoverableAuthError(error)) {
          await clearBrokenSession();
          return null;
        }
        throw error;
      }
      return currentSession?.access_token ?? null;
    } catch (error) {
      if (isRecoverableAuthError(error)) {
        await clearBrokenSession();
        return null;
      }
      console.error('アクセストークン取得エラー:', error);
      return null;
    }
  };

  const isAdmin = profile?.role === 'admin';

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      session,
      isLoading,
      isAdmin,
      signInWithGoogle,
      signOut,
      getAccessToken,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook that exposes the authentication context set by {@link AuthProvider}.
 *
 * @returns Authentication context including session data and helper actions.
 * @throws When called outside of an `AuthProvider` tree.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
