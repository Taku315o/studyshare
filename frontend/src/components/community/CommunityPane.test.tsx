import { render, screen } from '@testing-library/react';
import CommunityPane from '@/components/community/CommunityPane';

describe('CommunityPane', () => {
  it('shows empty state when there are no matching candidates', () => {
    render(
      <CommunityPane
        activeTab="matching"
        onTabChange={jest.fn()}
        searchKeyword=""
        onSearchKeywordChange={jest.fn()}
        activeChip="same-class"
        onChipChange={jest.fn()}
        candidates={[]}
        isLoading={false}
        errorMessage={null}
        onSendMessage={jest.fn()}
        onOpenMessagesMobile={jest.fn()}
      />,
    );

    expect(screen.getByText('マッチング候補がまだいません。')).toBeInTheDocument();
  });
});
