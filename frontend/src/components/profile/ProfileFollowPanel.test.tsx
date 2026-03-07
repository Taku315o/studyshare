import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import toast from 'react-hot-toast';
import { createSupabaseClient } from '@/lib/supabase/client';
import ProfileFollowPanel from './ProfileFollowPanel';

jest.mock('@/lib/supabase/client', () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

describe('ProfileFollowPanel', () => {
  const rpcMock = jest.fn();
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (createSupabaseClient as jest.Mock).mockReturnValue({
      rpc: rpcMock,
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('follows a user and updates the state optimistically', async () => {
    const user = userEvent.setup();
    const singleMock = jest.fn().mockResolvedValue({
      data: {
        is_following: true,
        followers_count: 6,
        following_count: 8,
      },
      error: null,
    });
    rpcMock.mockReturnValue({ single: singleMock });

    render(
      <ProfileFollowPanel
        targetUserId="target-1"
        currentUserId="viewer-1"
        targetDisplayName="田中太郎"
        initialFollowersCount={5}
        initialFollowingCount={8}
        initialIsFollowing={false}
        showFollowButton
      />,
    );

    await user.click(screen.getByRole('button', { name: 'フォローする' }));

    expect(rpcMock).toHaveBeenCalledWith('follow_user', {
      _following_user_id: 'target-1',
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'フォロー中' })).toBeInTheDocument();
    });
    expect(screen.getByText('6')).toBeInTheDocument();
  });

  it('blocks duplicate follow submission while request is pending', async () => {
    const user = userEvent.setup();
    let resolveRequest:
      | ((value: { data: { is_following: boolean; followers_count: number; following_count: number }; error: null }) => void)
      | undefined;
    const pendingPromise = new Promise<{ data: { is_following: boolean; followers_count: number; following_count: number }; error: null }>((resolve) => {
      resolveRequest = resolve;
    });
    const singleMock = jest.fn().mockReturnValue(pendingPromise);
    rpcMock.mockReturnValue({ single: singleMock });

    render(
      <ProfileFollowPanel
        targetUserId="target-1"
        currentUserId="viewer-1"
        targetDisplayName="田中太郎"
        initialFollowersCount={5}
        initialFollowingCount={8}
        initialIsFollowing={false}
        showFollowButton
      />,
    );

    await user.click(screen.getByRole('button', { name: 'フォローする' }));
    expect(screen.getByRole('button', { name: '更新中...' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '更新中...' }));

    expect(rpcMock).toHaveBeenCalledTimes(1);

    resolveRequest?.({
      data: {
        is_following: true,
        followers_count: 6,
        following_count: 8,
      },
      error: null,
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'フォロー中' })).toBeInTheDocument();
    });
  });

  it('rolls back optimistic state when follow fails', async () => {
    const user = userEvent.setup();
    const singleMock = jest.fn().mockResolvedValue({
      data: null,
      error: new Error('blocked'),
    });
    rpcMock.mockReturnValue({ single: singleMock });

    render(
      <ProfileFollowPanel
        targetUserId="target-1"
        currentUserId="viewer-1"
        targetDisplayName="田中太郎"
        initialFollowersCount={5}
        initialFollowingCount={8}
        initialIsFollowing={false}
        showFollowButton
      />,
    );

    await user.click(screen.getByRole('button', { name: 'フォローする' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('このユーザーはフォローできません');
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'フォローする' })).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});
