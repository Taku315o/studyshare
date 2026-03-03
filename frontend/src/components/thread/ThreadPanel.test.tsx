import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import supabase from '@/lib/supabase';
import ThreadPanel from './ThreadPanel';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock('@/lib/supabase', () => ({
  __esModule: true,
  default: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  },
}));

const mockRefresh = jest.fn();
const mockInsert = jest.fn();

const supabaseMock = supabase as unknown as {
  auth: {
    getUser: jest.Mock;
  };
  from: jest.Mock;
};

describe('ThreadPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ refresh: mockRefresh });
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mockInsert.mockResolvedValue({ error: null });
    supabaseMock.from.mockReturnValue({
      insert: mockInsert,
    });
  });

  it('renders deleted placeholder while keeping nested tree', () => {
    render(
      <ThreadPanel
        nodes={[
          {
            id: 'root-1',
            parentId: null,
            body: 'root-body',
            createdAt: '2026-03-01T10:00:00.000Z',
            deletedAt: '2026-03-01T11:00:00.000Z',
            author: {
              id: 'author-1',
              name: '山田太郎',
              avatarUrl: null,
            },
          },
          {
            id: 'child-1',
            parentId: 'root-1',
            body: 'reply-body',
            createdAt: '2026-03-01T10:10:00.000Z',
            deletedAt: null,
            author: {
              id: 'author-2',
              name: '鈴木花子',
              avatarUrl: null,
            },
          },
        ]}
        initialUserId="user-1"
        table="note_comments"
        targetColumn="note_id"
        parentColumn="parent_comment_id"
        targetId="note-1"
        emptyMessage="まだ投稿はありません"
        rootPlaceholder="本文を入力"
        replyPlaceholder="返信を入力"
        submitLabel="投稿する"
        submitSuccessMessage="投稿しました"
        submitFailureMessage="投稿に失敗しました"
      />,
    );

    expect(screen.getByText('削除された投稿です。')).toBeInTheDocument();
    expect(screen.getByText('reply-body')).toBeInTheDocument();
  });

  it('submits root post with parent null', async () => {
    const user = userEvent.setup();

    render(
      <ThreadPanel
        nodes={[]}
        initialUserId="user-1"
        table="note_comments"
        targetColumn="note_id"
        parentColumn="parent_comment_id"
        targetId="note-1"
        emptyMessage="まだ投稿はありません"
        rootPlaceholder="本文を入力"
        replyPlaceholder="返信を入力"
        submitLabel="投稿する"
        submitSuccessMessage="投稿しました"
        submitFailureMessage="投稿に失敗しました"
      />,
    );

    await user.type(screen.getByPlaceholderText('本文を入力'), '新しいコメント');
    await user.click(screen.getByRole('button', { name: '投稿する' }));

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith({
        note_id: 'note-1',
        parent_comment_id: null,
        author_id: 'user-1',
        body: '新しいコメント',
      });
    });
    expect(toast.success).toHaveBeenCalledWith('投稿しました');
    expect(mockRefresh).toHaveBeenCalled();
  });
});
