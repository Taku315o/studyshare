import { render, screen } from '@testing-library/react';
import MessagesPane from '@/components/community/MessagesPane';

describe('MessagesPane', () => {
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
        selectedThread={{
          threadId: 'thread-1',
          participantId: 'user-9',
          participantName: '佐藤 次郎',
          participantAvatarUrl: 'https://example.com/avatar.png',
          participantAffiliation: '法学部 / 法学科',
          lastMessagePreview: '',
          lastMessageAt: null,
          unreadCount: 0,
          isLocal: false,
        }}
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
});
