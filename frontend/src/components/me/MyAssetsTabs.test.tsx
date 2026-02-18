import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyAssetsTabs from './MyAssetsTabs';

describe('MyAssetsTabs', () => {
  it('switches between notes, reviews, and saved tabs', async () => {
    const user = userEvent.setup();

    render(
      <MyAssetsTabs
        notes={[
          {
            id: 'note-1',
            title: 'ノートA',
            body: '本文A',
            createdAt: '2026-02-18T10:00:00.000Z',
            offeringTitle: '応用プログラミング3',
            instructorName: '田中先生',
          },
        ]}
        reviews={[
          {
            id: 'review-1',
            rating: 4,
            comment: '口コミA',
            createdAt: '2026-02-18T10:00:00.000Z',
            offeringTitle: '応用プログラミング3',
            instructorName: '田中先生',
          },
        ]}
        isLoading={false}
      />,
    );

    expect(screen.getByText('ノートA')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /口コミ/ }));
    expect(screen.getByText('口コミA')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(screen.getByText('保存機能は Phase2 で有効化予定です。')).toBeInTheDocument();
  });
});
