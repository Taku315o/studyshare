import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OfferingTabs from './OfferingTabs';
import type { OfferingTabData } from '@/types/offering';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
  useSearchParams: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  __esModule: true,
  default: {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
    },
  },
}));

const mockPush = jest.fn();

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
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush, refresh: jest.fn() });
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
});
