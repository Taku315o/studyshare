import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ThreadList from '@/components/community/ThreadList';
import type { ThreadSummaryViewModel } from '@/types/community';

describe('ThreadList', () => {
  const baseThread: ThreadSummaryViewModel = {
    threadId: 'thread-1',
    participantId: 'user-100',
    participantName: '山田 太郎',
    participantAvatarUrl: 'https://example.com/avatar.png',
    participantAffiliation: '理学部 / 数学科',
    lastMessagePreview: 'よろしくお願いします',
    lastMessageAt: '2026-02-10T10:00:00.000Z',
    lastReadAt: null,
    lastIncomingMessageAt: '2026-02-10T10:00:00.000Z',
    participantLastReadAt: null,
    unreadCount: 0,
    isLocal: false,
  };

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps thread selection behavior', async () => {
    const onSelectThread = jest.fn();
    const user = userEvent.setup();

    render(
      <ThreadList
        threads={[baseThread]}
        selectedThreadId={null}
        onSelectThread={onSelectThread}
        isLoading={false}
      />,
    );

    await user.click(screen.getByRole('button', { name: /山田 太郎/ }));
    expect(onSelectThread).toHaveBeenCalledWith('thread-1');
  });

  it('links participant avatar and name to profile and does not select on link click', async () => {
    const onSelectThread = jest.fn();
    const user = userEvent.setup();

    render(
      <ThreadList
        threads={[baseThread]}
        selectedThreadId={null}
        onSelectThread={onSelectThread}
        isLoading={false}
      />,
    );

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/profile/user-100');
    expect(links[1]).toHaveAttribute('href', '/profile/user-100');

    await user.click(links[0]);
    expect(onSelectThread).not.toHaveBeenCalled();
  });

  it('does not render profile links when participantId is unknown', () => {
    const unknownThread: ThreadSummaryViewModel = {
      ...baseThread,
      threadId: 'thread-2',
      participantId: 'unknown',
    };

    render(
      <ThreadList
        threads={[unknownThread]}
        selectedThreadId={null}
        onSelectThread={jest.fn()}
        isLoading={false}
      />,
    );

    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('shows unread badge and emphasized preview when thread has unread messages', () => {
    render(
      <ThreadList
        threads={[
          {
            ...baseThread,
            unreadCount: 3,
          },
        ]}
        selectedThreadId={null}
        onSelectThread={jest.fn()}
        isLoading={false}
      />,
    );

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('よろしくお願いします')).toHaveClass('font-semibold');
  });
});
