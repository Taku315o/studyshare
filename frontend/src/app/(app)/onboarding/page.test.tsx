import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OnboardingPage from './page';
import { createSupabaseClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';

jest.mock('@/lib/supabase/client', () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('OnboardingPage', () => {
  const mockReplace = jest.fn();
  const mockRefresh = jest.fn();
  const getUserMock = jest.fn();
  const fromMock = jest.fn();
  const upsertMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useRouter as jest.Mock).mockReturnValue({
      replace: mockReplace,
      refresh: mockRefresh,
    });
    (useSearchParams as jest.Mock).mockReturnValue(
      new URLSearchParams('next=%2Fofferings%2Foffering-1%3Ftab%3Dnotes'),
    );

    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'user@example.com',
          user_metadata: { name: 'テストユーザー' },
        },
      },
      error: null,
    });

    upsertMock.mockResolvedValue({ error: null });

    fromMock.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn().mockResolvedValue({
                data: {
                  display_name: 'テストユーザー',
                  university_id: null,
                  grade_year: null,
                },
                error: null,
              }),
            })),
          })),
          upsert: upsertMock,
        };
      }

      if (table === 'universities') {
        return {
          select: jest.fn(() => ({
            order: jest.fn().mockResolvedValue({
              data: [
                { id: 'uni-1', name: '専修大学' },
                { id: 'uni-2', name: '明治大学' },
              ],
              error: null,
            }),
          })),
        };
      }

      return {};
    });

    (createSupabaseClient as jest.Mock).mockReturnValue({
      auth: {
        getUser: getUserMock,
      },
      from: fromMock,
    });
  });

  it('saves university and grade year, then redirects to next path', async () => {
    const user = userEvent.setup();

    render(<OnboardingPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '初期設定' })).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText('所属大学'), 'uni-1');
    await user.selectOptions(screen.getByLabelText('学年'), '2');
    await user.click(screen.getByRole('button', { name: '保存してはじめる' }));

    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalledWith(
        {
          user_id: 'user-1',
          display_name: 'テストユーザー',
          university_id: 'uni-1',
          grade_year: 2,
        },
        { onConflict: 'user_id' },
      );
    });

    expect(toast.success).toHaveBeenCalledWith('初期設定を保存しました');
    expect(mockReplace).toHaveBeenCalledWith('/offerings/offering-1?tab=notes');
    expect(mockRefresh).toHaveBeenCalled();
  });
});
