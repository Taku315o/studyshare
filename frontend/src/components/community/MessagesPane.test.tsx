import { render, screen } from '@testing-library/react';
import MessagesPane from '@/components/community/MessagesPane';

describe('MessagesPane', () => {
  const selectedThread = {
    threadId: 'thread-1',
    participantId: 'user-9',
    participantName: '佐藤 次郎',
    participantAvatarUrl: 'https://example.com/avatar.png',
    participantAffiliation: '法学部 / 法学科',
    lastMessagePreview: '',
    lastMessageAt: null,
    lastReadAt: null,
    lastIncomingMessageAt: null,
    participantLastReadAt: '2026-02-10T10:05:00.000Z',
    unreadCount: 0,
    isLocal: false,
  };

  it('shows empty state when there are no threads', () => {
    render(
      <MessagesPane
        unreadCount={0}
        threads={[]}
        selectedThreadId={null}
        selectedThread={null}
        messages={[]}
        currentUserId="user-1"
        threadsLoading={false}
        messagesLoading={false}
        messagesError={null}
        fallbackNotice={null}
        onSelectThread={jest.fn()}
        onSendMessage={jest.fn()}
      />,
    );

    expect(screen.getByText('スレッドがありません。左の候補からメッセージを始めてください。')).toBeInTheDocument();
  });

  it('links selected participant avatar and name to profile page', () => {
    render(
      <MessagesPane
        unreadCount={0}
        threads={[]}
        selectedThreadId="thread-1"
        selectedThread={selectedThread}
        messages={[]}
        currentUserId="user-1"
        threadsLoading={false}
        messagesLoading={false}
        messagesError={null}
        fallbackNotice={null}
        onSelectThread={jest.fn()}
        onSendMessage={jest.fn()}
      />,
    );

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/profile/user-9');
    expect(links[1]).toHaveAttribute('href', '/profile/user-9');
  });

  it('shows read receipt only for the latest own message', () => {
    render(
      <MessagesPane
        unreadCount={0}
        threads={[selectedThread]}
        selectedThreadId="thread-1"
        selectedThread={selectedThread}
        messages={[
          {
            id: 'message-1',
            threadId: 'thread-1',
            senderId: 'user-1',
            body: '最初の送信',
            createdAt: '2026-02-10T10:00:00.000Z',
            readAt: '2026-02-10T10:05:00.000Z',
            isLocal: false,
          },
          {
            id: 'message-2',
            threadId: 'thread-1',
            senderId: 'user-9',
            body: '返信',
            createdAt: '2026-02-10T10:03:00.000Z',
            readAt: null,
            isLocal: false,
          },
          {
            id: 'message-3',
            threadId: 'thread-1',
            senderId: 'user-1',
            body: '最後の送信',
            createdAt: '2026-02-10T10:04:00.000Z',
            readAt: null,
            isLocal: false,
          },
        ]}
        currentUserId="user-1"
        threadsLoading={false}
        messagesLoading={false}
        messagesError={null}
        fallbackNotice={null}
        onSelectThread={jest.fn()}
        onSendMessage={jest.fn()}
      />,
    );

    expect(screen.getByText('未読')).toBeInTheDocument();
    expect(screen.queryByText('既読')).not.toBeInTheDocument();
  });
});
