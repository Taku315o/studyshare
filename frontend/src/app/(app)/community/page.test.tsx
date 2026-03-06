import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CommunityPage from './page';
import { createSupabaseClient } from '@/lib/supabase/client';

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/lib/supabase/client', () => ({
  createSupabaseClient: jest.fn(),
}));

type MessageRecord = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

type ConversationMemberRecord = {
  conversation_id: string;
  user_id: string;
  last_read_at: string | null;
};

describe('CommunityPage', () => {
  const getUserMock = jest.fn();
  const onAuthStateChangeMock = jest.fn();
  const rpcMock = jest.fn();
  const updateEqUserMock = jest.fn();
  const updateEqConversationMock = jest.fn();
  const removeChannelMock = jest.fn();
  const channelOnMock = jest.fn();
  const channelSubscribeMock = jest.fn();

  const ownMembers: ConversationMemberRecord[] = [
    { conversation_id: 'thread-1', user_id: 'user-1', last_read_at: '2026-02-10T09:30:00.000Z' },
    { conversation_id: 'thread-2', user_id: 'user-1', last_read_at: null },
  ];
  const allMembers: ConversationMemberRecord[] = [
    ...ownMembers,
    { conversation_id: 'thread-1', user_id: 'user-2', last_read_at: null },
    { conversation_id: 'thread-2', user_id: 'user-3', last_read_at: null },
  ];
  const profileRows = [
    { user_id: 'user-2', display_name: '山田 太郎', avatar_url: null, faculty: '経済学部', department: '経済学科' },
    { user_id: 'user-3', display_name: '佐藤 花子', avatar_url: null, faculty: '文学部', department: '国文学科' },
  ];
  const messages: MessageRecord[] = [
    {
      id: 'message-3',
      conversation_id: 'thread-2',
      sender_id: 'user-3',
      body: '未読メッセージ',
      created_at: '2026-02-10T10:10:00.000Z',
    },
    {
      id: 'message-2',
      conversation_id: 'thread-1',
      sender_id: 'user-2',
      body: '既読メッセージ',
      created_at: '2026-02-10T09:00:00.000Z',
    },
    {
      id: 'message-1',
      conversation_id: 'thread-1',
      sender_id: 'user-1',
      body: '自分の送信',
      created_at: '2026-02-10T08:00:00.000Z',
    },
  ];
  const threadMessages: Record<string, MessageRecord[]> = {
    'thread-1': [
      {
        id: 'message-1',
        conversation_id: 'thread-1',
        sender_id: 'user-1',
        body: '自分の送信',
        created_at: '2026-02-10T08:00:00.000Z',
      },
      {
        id: 'message-2',
        conversation_id: 'thread-1',
        sender_id: 'user-2',
        body: '既読メッセージ',
        created_at: '2026-02-10T09:00:00.000Z',
      },
    ],
    'thread-2': [
      {
        id: 'message-4',
        conversation_id: 'thread-2',
        sender_id: 'user-1',
        body: 'こちらから送信',
        created_at: '2026-02-10T10:00:00.000Z',
      },
      {
        id: 'message-3',
        conversation_id: 'thread-2',
        sender_id: 'user-3',
        body: '未読メッセージ',
        created_at: '2026-02-10T10:10:00.000Z',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });

    channelOnMock.mockReturnThis();
    channelSubscribeMock.mockReturnValue({ unsubscribe: jest.fn() });
    removeChannelMock.mockResolvedValue(undefined);

    updateEqUserMock.mockResolvedValue({ error: null });
    updateEqConversationMock.mockReturnValue({ eq: updateEqUserMock });

    const createMessagesSelect = () => ({
      in: jest.fn().mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: messages, error: null }),
        }),
      }),
      eq: jest.fn((column: string, value: string) => ({
        order: jest.fn().mockResolvedValue({ data: threadMessages[value] ?? [], error: null }),
      })),
    });

    const createConversationMembersSelect = () => ({
      eq: jest.fn().mockResolvedValue({ data: ownMembers, error: null }),
      in: jest.fn().mockResolvedValue({ data: allMembers, error: null }),
    });

    const createProfilesSelect = () => ({
      in: jest.fn().mockResolvedValue({ data: profileRows, error: null }),
      eq: jest.fn().mockReturnValue({
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });

    rpcMock.mockImplementation((name: string) => {
      if (name === 'find_match_candidates') {
        return Promise.resolve({
          data: [
            {
              matched_user_id: 'candidate-1',
              display_name: '山田 太郎',
              avatar_url: null,
              faculty: '経済学部',
              department: '経済学科',
              shared_offering_count: 1,
            },
          ],
          error: null,
        });
      }

      if (name === 'create_direct_conversation') {
        return Promise.resolve({
          data: null,
          error: new Error('not allowed'),
        });
      }

      if (name === 'can_send_message') {
        return Promise.resolve({
          data: false,
          error: null,
        });
      }

      return Promise.resolve({ data: null, error: null });
    });

    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    onAuthStateChangeMock.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: jest.fn(),
        },
      },
    });

    (createSupabaseClient as jest.Mock).mockReturnValue({
      auth: {
        getUser: getUserMock,
        onAuthStateChange: onAuthStateChangeMock,
      },
      rpc: rpcMock,
      from: jest.fn((table: string) => {
        if (table === 'conversation_members') {
          return {
            select: jest.fn(() => createConversationMembersSelect()),
            update: jest.fn(() => ({
              eq: updateEqConversationMock,
            })),
          };
        }

        if (table === 'messages') {
          return {
            select: jest.fn(() => createMessagesSelect()),
            insert: jest.fn(),
          };
        }

        if (table === 'profiles') {
          return {
            select: jest.fn(() => createProfilesSelect()),
          };
        }

        return {
          select: jest.fn(),
        };
      }),
      channel: jest.fn(() => ({
        on: channelOnMock,
        subscribe: channelSubscribeMock,
      })),
      removeChannel: removeChannelMock,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows unlock notice and does not enter local conversation mode when sender is not unlocked', async () => {
    const user = userEvent.setup();

    render(<CommunityPage />);

    const cta = await screen.findByRole('button', { name: 'メッセージを送る' });
    await user.click(cta);

    await waitFor(() => {
      expect(screen.queryAllByText(/2年生以上はノート\/口コミの投稿を2件以上するとDMを送信できます/).length).toBeGreaterThan(0);
    });

    expect(screen.queryByText(/ローカル会話モード/)).not.toBeInTheDocument();
  });

  it('shows unread count for threads based on last_read_at', async () => {
    render(<CommunityPage />);

    expect(await screen.findByText('メッセージ (1)')).toBeInTheDocument();
    expect(screen.getByText('未読メッセージ')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('marks thread as read after selecting an unread thread', async () => {
    const user = userEvent.setup();

    render(<CommunityPage />);

    const unreadThread = await screen.findByRole('button', { name: /佐藤 花子/ });
    await user.click(unreadThread);

    await waitFor(() => {
      expect(updateEqConversationMock).toHaveBeenCalledWith('conversation_id', 'thread-2');
      expect(updateEqUserMock).toHaveBeenCalledWith('user_id', 'user-1');
    });

    expect(screen.getAllByText('メッセージ (0)').length).toBeGreaterThan(0);
  });
});
