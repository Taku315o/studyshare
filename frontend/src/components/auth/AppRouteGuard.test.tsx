import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import AppRouteGuard from './AppRouteGuard';
import { useAuth } from '@/context/AuthContext';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import supabase from '@/lib/supabase';

jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
  useSearchParams: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  __esModule: true,
  default: {
    from: jest.fn(),
  },
}));

describe('AppRouteGuard', () => {
  const mockReplace = jest.fn();
  const supabaseMock = supabase as unknown as {
    from: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });
    (usePathname as jest.Mock).mockReturnValue('/home');
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams());
    supabaseMock.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: { university_id: 'uni-1', grade_year: 1 },
            error: null,
          }),
        }),
      }),
    });
  });

  it('shows loading state while auth is resolving', () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: true });

    render(
      <AppRouteGuard>
        <div>protected</div>
      </AppRouteGuard>,
    );

    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
  });

  it('redirects to root when unauthenticated', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });

    render(
      <AppRouteGuard>
        <div>protected</div>
      </AppRouteGuard>,
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
  });

  it('renders children when authenticated and profile setup is complete', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 'user-1' }, isLoading: false });

    render(
      <AppRouteGuard>
        <div>protected</div>
      </AppRouteGuard>,
    );

    await waitFor(() => {
      expect(screen.getByText('protected')).toBeInTheDocument();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('redirects authenticated users to onboarding when profile setup is incomplete', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 'user-1' }, isLoading: false });
    supabaseMock.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: { university_id: null, grade_year: null },
            error: null,
          }),
        }),
      }),
    });

    render(
      <AppRouteGuard>
        <div>protected</div>
      </AppRouteGuard>,
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/onboarding?next=%2Fhome');
    });
  });
});
