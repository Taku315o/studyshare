import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import supabase from '@/lib/supabase';
import { useRouter } from 'next/navigation';

// モックの設定
jest.mock('@/lib/supabase', () => ({
  __esModule: true,
  default: {
    auth: {
      getSession: jest.fn(),
      getUser: jest.fn(),
      onAuthStateChange: jest.fn(),
      signInWithOAuth: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
    })),
  },
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// テスト用コンポーネント
const TestComponent = () => {
  const auth = useAuth();
  
  return (
    <div>
      <div data-testid="user">{auth.user?.email || 'No user'}</div>
      <div data-testid="loading">{auth.isLoading ? 'Loading' : 'Not loading'}</div>
      <div data-testid="admin">{auth.isAdmin ? 'Admin' : 'Not admin'}</div>
      <div data-testid="profile">{auth.profile?.email || 'No profile'}</div>
      <button 
        data-testid="signin" 
        onClick={auth.signInWithGoogle}
      >
        Sign In
      </button>
      <button 
        data-testid="signout" 
        onClick={auth.signOut}
      >
        Sign Out
      </button>
    </div>
  );
};

describe('AuthContext', () => {
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  describe('初期状態', () => {
    it('should render loading state initially', () => {
      (supabase.auth.getSession as jest.Mock).mockReturnValue(new Promise(() => {}));
      (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId('loading')).toHaveTextContent('Loading');
    });
  });

  describe('認証済みユーザー', () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      app_metadata: { role: 'student' },
      user_metadata: {},
    };

    const mockSession = {
      user: mockUser,
      access_token: 'mock-token',
    };

    const mockProfile = {
      user_id: 'user-1',
      display_name: 'test-user',
    };

    beforeEach(() => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
      
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          }),
        }),
      });

      (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      });
    });

    const renderAuth = async () => {
      await act(async () => {
        render(
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        );
      });
    };

    it('should display user information when authenticated', async () => {
      await renderAuth();

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('Not loading');
      });

      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
      expect(screen.getByTestId('profile')).toHaveTextContent('test@example.com');
      expect(screen.getByTestId('admin')).toHaveTextContent('Not admin');
    });

    it('should show admin status for admin users', async () => {
      const adminUser = { ...mockUser, app_metadata: { role: 'admin' } };

      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { ...mockSession, user: adminUser } },
        error: null,
      });

      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: adminUser },
        error: null,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          }),
        }),
      });

      await renderAuth();

      await waitFor(() => {
        expect(screen.getByTestId('admin')).toHaveTextContent('Admin');
      });
    });
  });

  describe('認証操作', () => {
    beforeEach(() => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: null,
      });
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: null,
      });
      (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      });
    });

    const renderAuth = async () => {
      await act(async () => {
        render(
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        );
      });
    };

    it('should call signInWithOAuth when signInWithGoogle is called', async () => {
      (supabase.auth.signInWithOAuth as jest.Mock).mockResolvedValue({
        data: {},
        error: null,
      });

      await renderAuth();

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('Not loading');
      });

      await act(async () => {
        screen.getByTestId('signin').click();
      });

      expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: expect.stringContaining('/auth/callback'),
        },
      });
    });

    it('should call signOut when signOut is called', async () => {
      (supabase.auth.signOut as jest.Mock).mockResolvedValue({
        error: null,
      });

      await renderAuth();

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('Not loading');
      });

      await act(async () => {
        screen.getByTestId('signout').click();
      });

      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(mockRouter.push).toHaveBeenCalledWith('/');
    });
  });

  describe('エラーハンドリング', () => {
    it('should handle session fetch error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: new Error('Session fetch failed'),
      });
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: null,
      });
      (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      });

      await act(async () => {
        render(
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        );
      });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('セッション取得エラー:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });

    it('should clear broken session without logging when refresh token is invalid', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: new Error('Invalid Refresh Token: Refresh Token Not Found'),
      });
      (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      });
      (supabase.auth.signOut as jest.Mock).mockResolvedValue({
        error: null,
      });

      await act(async () => {
        render(
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('Not loading');
      });

      expect(screen.getByTestId('user')).toHaveTextContent('No user');
      expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
      expect(consoleSpy).not.toHaveBeenCalledWith('セッション取得エラー:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should handle profile fetch error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        app_metadata: {},
        user_metadata: {},
      };

      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null,
      });
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: new Error('Profile fetch failed'),
            }),
          }),
        }),
      });

      (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      });

      await act(async () => {
        render(
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        );
      });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('プロフィール取得エラー:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });
  });
});
