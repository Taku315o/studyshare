import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CommunityPage from './page';
import { createSupabaseClient } from '@/lib/supabase/client';

jest.mock('@/lib/supabase/client', () => ({
  createSupabaseClient: jest.fn(),
}));

describe('CommunityPage', () => {
  const getUserMock = jest.fn();
  const onAuthStateChangeMock = jest.fn();
  const rpcMock = jest.fn();
  const eqMock = jest.fn();
  const selectMock = jest.fn();
  const fromMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    eqMock.mockResolvedValue({ data: [], error: null });
    selectMock.mockReturnValue({ eq: eqMock });

    fromMock.mockImplementation((table: string) => {
      if (table === 'conversation_members') {
        return { select: selectMock };
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        in: jest.fn().mockResolvedValue({ data: [], error: null }),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };
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
      from: fromMock,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('falls back to local thread when direct conversation creation fails', async () => {
    const user = userEvent.setup();

    render(<CommunityPage />);

    const cta = await screen.findByRole('button', { name: 'メッセージを送る' });
    await user.click(cta);

    await waitFor(() => {
      expect(screen.queryAllByText(/ローカル会話モード/).length).toBeGreaterThan(0);
    });
  });
});
