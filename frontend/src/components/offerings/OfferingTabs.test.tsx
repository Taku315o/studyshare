import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OfferingTabs from './OfferingTabs';
import type { OfferingTabData } from '@/types/offering';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import supabase from '@/lib/supabase';

const mockInsert = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
  useSearchParams: jest.fn(),
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock('@/lib/api', () => ({
  uploadNoteImage: jest.fn(),
  isUploadApiError: jest.fn((error: unknown) => Boolean(error && typeof error === 'object' && 'kind' in error)),
}));

jest.mock('@/lib/supabase', () => ({
  __esModule: true,
  default: {
    auth: {
      getUser: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
    from: jest.fn(),
  },
}));

const mockPush = jest.fn();
const mockRefresh = jest.fn();
const supabaseMock = supabase as unknown as {
  auth: {
    getUser: jest.Mock;
    onAuthStateChange: jest.Mock;
  };
  from: jest.Mock;
};

const baseData: OfferingTabData = {
  notes: [],
  reviews: [],
  questions: [],
  hasMoreNotes: false,
  hasMoreReviews: false,
  hasMoreQuestions: false,
  reviewStats: {
    avgRating: 0,
    reviewCount: 0,
    distribution: [0, 0, 0, 0, 0],
  },
};

describe('OfferingTabs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    supabaseMock.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    });
    mockInsert.mockResolvedValue({ error: null });
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'notes' || table === 'reviews' || table === 'questions') {
        return { insert: mockInsert };
      }
      return {
        delete: () => ({
          eq: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
        }),
        insert: jest.fn().mockResolvedValue({ error: null }),
      };
    });
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush, refresh: mockRefresh });
    (usePathname as jest.Mock).mockReturnValue('/offerings/offering-1');
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams('tab=notes&notesPage=1&reviewsPage=1&questionsPage=1'));
  });

  it('renders notes empty state and disables post button when posting is not allowed', () => {
    render(
      <OfferingTabs
        offeringId="offering-1"
        activeTab="notes"
        counts={{ notes: 0, reviews: 0, questions: 0, students: 0 }}
        data={baseData}
        notesPage={1}
        reviewsPage={1}
        questionsPage={1}
        canPost={false}
        currentUserId={null}
      />,
    );

    expect(screen.getByRole('heading', { name: 'ノート 0' })).toBeInTheDocument();
    expect(screen.getByText('まだノートは投稿されていません')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ノートを投稿' })).toBeDisabled();
  });

  it('updates query params when switching tabs', async () => {
    const user = userEvent.setup();

    render(
      <OfferingTabs
        offeringId="offering-1"
        activeTab="notes"
        counts={{ notes: 0, reviews: 0, questions: 0, students: 0 }}
        data={baseData}
        notesPage={1}
        reviewsPage={1}
        questionsPage={1}
        canPost
        currentUserId={null}
      />,
    );

    await user.click(screen.getByRole('button', { name: '口コミ 0' }));

    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('/offerings/offering-1?'),
    );
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('tab=reviews'),
    );
  });

  it('submits note when auth is restored after initial mount check', async () => {
    const user = userEvent.setup();

    supabaseMock.auth.getUser
      .mockResolvedValueOnce({ data: { user: null }, error: null })
      .mockResolvedValueOnce({ data: { user: { id: 'user-1' } }, error: null });

    render(
      <OfferingTabs
        offeringId="offering-1"
        activeTab="notes"
        counts={{ notes: 0, reviews: 0, questions: 0, students: 0 }}
        data={baseData}
        notesPage={1}
        reviewsPage={1}
        questionsPage={1}
        canPost
        currentUserId={null}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'ノートを投稿' }));
    await user.type(screen.getByPlaceholderText('タイトル'), 'テストノート');
    await user.type(screen.getByPlaceholderText('本文'), '本文です');
    await user.click(screen.getAllByRole('button', { name: '投稿する' })[0]);

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          offering_id: 'offering-1',
          author_id: 'user-1',
          title: 'テストノート',
          body_md: '本文です',
        }),
      );
    });

    expect(toast.error).not.toHaveBeenCalledWith('ログインが必要です');
    expect(toast.success).toHaveBeenCalledWith('ノートを投稿しました');
    expect(mockRefresh).toHaveBeenCalled();
  });
});
