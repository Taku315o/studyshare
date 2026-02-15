import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import AppRouteGuard from './AppRouteGuard';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

describe('AppRouteGuard', () => {
  const mockReplace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });
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

  it('renders children when authenticated', () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 'user-1' }, isLoading: false });

    render(
      <AppRouteGuard>
        <div>protected</div>
      </AppRouteGuard>,
    );

    expect(screen.getByText('protected')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
