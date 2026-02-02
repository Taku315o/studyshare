"use client";


//AuthContext.tsx
// ユーザー認証状態を管理し、アプリケーション全体で共有するためのContextとProvider
//ユーザー情報（user）、セッション（session）、プロフィール（profile）などを、アプリ内のどのコンポーネントからでも直接呼び出せるようにします。
// Googleログインやログアウトの関数もここで定義されています。
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import supabase from '@/lib/supabase';
import { setAuthToken } from '@/lib/api';//401 はバックエンドが認証トークンを受け取れていない可能性が高いので、セッション変更時に必ず Authorization を同期するように修正しました。
import { useRouter } from 'next/navigation';//Next.js 13+ の App Router で使用されるライブラリでページ遷移やURL操作を扱うためのフックや関数

type UserProfile = {
  id: string;
  email: string;
  role: 'student' | 'admin';
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

  // セッション初期化
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('セッション取得エラー:', error);
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        setAuthToken(session?.access_token ?? null);

        if (session?.user) {
          const { error: userError } = await supabase.auth.getUser();
          if (userError) {
            console.error('セッション検証エラー:', userError);
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
            setProfile(null);
            setAuthToken(null);
            return;
          }

          const { data: profileData, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profileError) {
            console.error('プロフィール取得エラー:', profileError);
          }

          if (profileData) {
            setProfile(profileData);
          }
        }
      } catch (error) {
        console.error('セッション初期化エラー:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('認証状態変更:', event, session?.user?.id);
        
        setSession(session);
        setUser(session?.user ?? null);
        setAuthToken(session?.access_token ?? null);
        
        if (session?.user) {
          const { data: profileData, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profileError) {
            console.error('プロフィール取得エラー:', profileError);
          }

          if (profileData) {
            setProfile(profileData);
          }
        } else {
          setProfile(null);
        }
        
        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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

  // JWTトークン取得
  const getAccessToken = async (): Promise<string | null> => {
    if (!session) return null;
    return session.access_token;
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