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
});
