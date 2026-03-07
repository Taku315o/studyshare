import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MatchCard from '@/components/community/MatchCard';
import type { MatchCandidateViewModel } from '@/types/community';

describe('MatchCard', () => {
  const candidate: MatchCandidateViewModel = {
    userId: 'user-42',
    displayName: '田中 花子',
    avatarUrl: 'https://example.com/avatar.png',
    faculty: '工学部',
    department: '情報工学科',
    sharedOfferingCount: 2,
    summaryLabel: '共有Offering 2件',
  };

  it('links avatar and name to profile page and keeps send button behavior', async () => {
    const onSendMessage = jest.fn();
    const user = userEvent.setup();

    render(<MatchCard candidate={candidate} onSendMessage={onSendMessage} />);

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/profile/user-42');
    expect(links[1]).toHaveAttribute('href', '/profile/user-42');

    await user.click(screen.getByRole('button', { name: 'メッセージを送る' }));
    expect(onSendMessage).toHaveBeenCalledWith(candidate);
  });
});
