import React from 'react';
import { render, screen } from '@testing-library/react';
import Header from '../Header';
import { useAuth } from '@/context/AuthContext';

jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

describe('Header', () => {
  const baseAuth = {
    user: null,
    isLoading: false,
    signInWithGoogle: jest.fn(),
    signOut: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders profile link for authenticated users', () => {
    (useAuth as jest.Mock).mockReturnValue({
      ...baseAuth,
      user: { id: 'user-1', email: 'test@example.com' },
    });

    render(<Header />);

    const profileLink = screen.getByRole('link', { name: 'マイページ' });
    expect(profileLink).toHaveAttribute('href', '/me');
  });

  it('does not render profile link for unauthenticated users', () => {
    (useAuth as jest.Mock).mockReturnValue(baseAuth);

    render(<Header />);

    expect(screen.queryByRole('link', { name: 'マイページ' })).not.toBeInTheDocument();
  });
});
