import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createSupabaseClient } from '@/lib/supabase/client';
import FollowListModal from './FollowListModal';

jest.mock('@/lib/supabase/client', () => ({
  createSupabaseClient: jest.fn(),
}));

function createRows(count: number, offset = 0) {
  return Array.from({ length: count }, (_, index) => ({
    user_id: `user-${offset + index + 1}`,
    display_name: `ユーザー${offset + index + 1}`,
    avatar_url: null,
    faculty: '経済学部',
    department: null,
    grade_year: 2,
    university_name: '専修大学',
    followed_at: `2026-03-${String((offset + index + 1) % 28 || 28).padStart(2, '0')}T10:00:00.000Z`,
  }));
}

describe('FollowListModal', () => {
  const rpcMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (createSupabaseClient as jest.Mock).mockReturnValue({
      rpc: rpcMock,
    });
  });

  it('loads 20 profiles first and appends more profiles on demand', async () => {
    const user = userEvent.setup();
    rpcMock
      .mockResolvedValueOnce({
        data: createRows(21),
        error: null,
      })
      .mockResolvedValueOnce({
        data: createRows(1, 20),
        error: null,
      });

    render(
      <FollowListModal
        targetUserId="target-1"
        mode="followers"
        open
        onClose={jest.fn()}
        title="田中太郎のフォロワー"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('ユーザー1')).toBeInTheDocument();
      expect(screen.getByText('ユーザー20')).toBeInTheDocument();
    });

    expect(screen.queryByText('ユーザー21')).not.toBeInTheDocument();
    expect(rpcMock).toHaveBeenCalledWith('list_follow_profiles', {
      _target_user_id: 'target-1',
      _direction: 'followers',
      _limit: 21,
      _offset: 0,
    });

    const firstLink = screen.getByText('ユーザー1').closest('a');
    expect(firstLink).toHaveAttribute('href', '/profile/user-1');

    await user.click(screen.getByRole('button', { name: 'もっと見る' }));

    await waitFor(() => {
      expect(screen.getByText('ユーザー21')).toBeInTheDocument();
    });

    expect(rpcMock).toHaveBeenLastCalledWith('list_follow_profiles', {
      _target_user_id: 'target-1',
      _direction: 'followers',
      _limit: 21,
      _offset: 20,
    });
  });
});
