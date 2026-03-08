import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MePage from './page';
import { uploadAvatarImage } from '@/lib/api';
import { createSupabaseClient } from '@/lib/supabase/client';

jest.mock('@/lib/supabase/client', () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  uploadAvatarImage: jest.fn(),
  isUploadApiError: jest.fn((error: unknown) => Boolean(error && typeof error === 'object' && 'kind' in error)),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    signOut: jest.fn(),
  }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  usePathname: () => '/me',
  useSearchParams: () => new URLSearchParams(),
}));

const uploadAvatarImageMock = uploadAvatarImage as jest.Mock;

describe('MePage', () => {
  const getUserMock = jest.fn();
  const fromMock = jest.fn();
  const profilesUpsertMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    uploadAvatarImageMock.mockResolvedValue({ url: 'https://example.com/avatars/new-avatar.png' });

    const notesChain = {
      eq: jest.fn(),
      is: jest.fn(),
      order: jest.fn(),
    };
    notesChain.eq.mockReturnValue(notesChain);
    notesChain.is.mockReturnValue(notesChain);
    notesChain.order.mockResolvedValue({
      data: [
        {
          id: 'note-1',
          title: '自分のノート',
          body_md: '本文',
          created_at: '2026-02-18T10:00:00.000Z',
          offering: {
            id: 'offering-1',
            instructor: '田中先生',
            courses: { name: '応用プログラミング3' },
          },
        },
      ],
      error: null,
    });

    const reviewsChain = {
      eq: jest.fn(),
      is: jest.fn(),
      order: jest.fn(),
    };
    reviewsChain.eq.mockReturnValue(reviewsChain);
    reviewsChain.is.mockReturnValue(reviewsChain);
    reviewsChain.order.mockResolvedValue({
      data: [
        {
          id: 'review-1',
          rating_overall: 4,
          comment: 'わかりやすかった',
          created_at: '2026-02-17T10:00:00.000Z',
          offering: {
            id: 'offering-1',
            instructor: '田中先生',
            courses: { name: '応用プログラミング3' },
          },
        },
      ],
      error: null,
    });

    const enrollmentsChain = {
      eq: jest.fn(),
      in: jest.fn(),
    };
    enrollmentsChain.eq.mockReturnValue(enrollmentsChain);
    enrollmentsChain.in.mockResolvedValue({
      data: [
        {
          created_at: '2026-02-16T10:00:00.000Z',
          status: 'enrolled',
          offering: {
            id: 'offering-1',
            instructor: '田中先生',
            courses: { name: '応用プログラミング3' },
            terms: {
              id: 'term-1',
              year: 2026,
              season: 'first_half',
              start_date: '2026-04-01',
              end_date: '2026-08-01',
            },
            offering_slots: [
              {
                day_of_week: 3,
                period: 2,
                start_time: '10:45:00',
              },
            ],
          },
        },
      ],
      error: null,
    });

    const savedReactionsChain = {
      eq: jest.fn(),
      in: jest.fn(),
      order: jest.fn(),
    };
    savedReactionsChain.eq.mockReturnValue(savedReactionsChain);
    savedReactionsChain.in.mockReturnValue(savedReactionsChain);
    savedReactionsChain.order.mockResolvedValue({
      data: [
        {
          kind: 'bookmark',
          created_at: '2026-02-20T10:00:00.000Z',
          note: {
            id: 'saved-note-1',
            title: '保存対象ノート',
            body_md: '保存本文',
            created_at: '2026-02-10T09:00:00.000Z',
            offering: {
              id: 'offering-1',
              instructor: '田中先生',
              courses: { name: '応用プログラミング3' },
            },
          },
        },
        {
          kind: 'like',
          created_at: '2026-02-19T10:00:00.000Z',
          note: {
            id: 'saved-note-1',
            title: '保存対象ノート',
            body_md: '保存本文',
            created_at: '2026-02-10T09:00:00.000Z',
            offering: {
              id: 'offering-1',
              instructor: '田中先生',
              courses: { name: '応用プログラミング3' },
            },
          },
        },
      ],
      error: null,
    });

    const profilesUpsertSelectSingleMock = jest.fn().mockResolvedValue({
      data: {
        user_id: 'user-1',
        display_name: '更新後ユーザー',
        avatar_url: 'https://example.com/avatars/new-avatar.png',
        bio: '更新後の自己紹介',
        faculty: '理工学部',
        department: null,
        university_id: 'uni-2',
        grade_year: 3,
      },
      error: null,
    });
    const profilesUpsertSelectMock = jest.fn().mockReturnValue({ single: profilesUpsertSelectSingleMock });
    profilesUpsertMock.mockReturnValue({ select: profilesUpsertSelectMock });

    fromMock.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn().mockResolvedValue({
                data: {
                  user_id: 'user-1',
                  display_name: 'テストユーザー',
                  avatar_url: null,
                  bio: '初期自己紹介',
                  faculty: '経済学部',
                  department: '経済学科',
                  university_id: 'uni-1',
                  grade_year: 2,
                  university: { name: '専修大学' },
                },
                error: null,
              }),
            })),
          })),
          upsert: profilesUpsertMock,
        };
      }
      if (table === 'user_stats') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn().mockResolvedValue({
                data: {
                  followers_count: 12,
                  following_count: 7,
                },
                error: null,
              }),
            })),
          })),
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
      if (table === 'notes') {
        return {
          select: jest.fn(() => notesChain),
        };
      }
      if (table === 'reviews') {
        return {
          select: jest.fn(() => reviewsChain),
        };
      }
      if (table === 'enrollments') {
        return {
          select: jest.fn(() => enrollmentsChain),
        };
      }
      if (table === 'note_reactions') {
        return {
          select: jest.fn(() => savedReactionsChain),
        };
      }
      return {
        select: jest.fn(),
      };
    });

    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'user@example.com',
          user_metadata: { name: 'ユーザー' },
        },
      },
      error: null,
    });

    (createSupabaseClient as jest.Mock).mockReturnValue({
      auth: {
        getUser: getUserMock,
      },
      from: fromMock,
    });
  });

  it('renders four main sections after loading', async () => {
    render(<MePage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'プロフィール' })).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: '自分の資産' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '時間割サマリ' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '設定' })).toBeInTheDocument();
    expect(screen.getByText('フォロワー')).toBeInTheDocument();
    expect(screen.getByText('フォロー中')).toBeInTheDocument();
  });

  it('shows deduplicated saved notes with like/bookmark badges in saved tab', async () => {
    const user = userEvent.setup();
    render(<MePage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /保存 \(1\)/ })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /保存 \(1\)/ }));

    expect(screen.getByText('保存対象ノート')).toBeInTheDocument();
    expect(screen.getByText('いいね済み')).toBeInTheDocument();
    expect(screen.getByText('ブックマーク済み')).toBeInTheDocument();
    expect(screen.getAllByText('保存対象ノート')).toHaveLength(1);
  });

  it('uploads avatar through backend and includes bio in profiles upsert payload', async () => {
    const user = userEvent.setup();
    const avatarFile = new File(['avatar'], 'avatar.png', { type: 'image/png' });

    render(<MePage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'プロフィール編集' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'プロフィール編集' }));
    await user.clear(screen.getByLabelText('表示名'));
    await user.type(screen.getByLabelText('表示名'), '更新後ユーザー');
    await user.selectOptions(screen.getByLabelText('所属大学'), 'uni-2');
    await user.selectOptions(screen.getByLabelText('学年'), '3');
    await user.clear(screen.getByLabelText('学部（任意）'));
    await user.type(screen.getByLabelText('学部（任意）'), '理工学部');
    await user.clear(screen.getByLabelText('自己紹介（任意）'));
    await user.type(screen.getByLabelText('自己紹介（任意）'), '更新後の自己紹介');
    await user.upload(screen.getByLabelText('アバター画像（任意）'), avatarFile);
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(uploadAvatarImageMock).toHaveBeenCalledWith(avatarFile, {
        previousUrl: null,
      });
      expect(profilesUpsertMock).toHaveBeenCalledWith(
        {
          user_id: 'user-1',
          display_name: '更新後ユーザー',
          university_id: 'uni-2',
          grade_year: 3,
          faculty: '理工学部',
          bio: '更新後の自己紹介',
          avatar_url: 'https://example.com/avatars/new-avatar.png',
        },
        { onConflict: 'user_id' },
      );
    });
  });

  it('aborts profile save when avatar upload fails', async () => {
    const user = userEvent.setup();
    const avatarFile = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    uploadAvatarImageMock.mockRejectedValueOnce(new Error('upload failed'));

    render(<MePage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'プロフィール編集' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'プロフィール編集' }));
    await user.upload(screen.getByLabelText('アバター画像（任意）'), avatarFile);
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(uploadAvatarImageMock).toHaveBeenCalledWith(avatarFile, {
        previousUrl: null,
      });
    });
    expect(profilesUpsertMock).not.toHaveBeenCalled();
  });
});
