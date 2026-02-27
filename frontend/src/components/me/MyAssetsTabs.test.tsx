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
        savedNotes={[
          {
            id: 'saved-note-1',
            title: '保存済みノート',
            body: '保存本文',
            createdAt: '2026-02-16T10:00:00.000Z',
            offeringTitle: 'データベース論',
            instructorName: '佐藤先生',
            savedAt: '2026-02-20T09:00:00.000Z',
            savedByLike: true,
            savedByBookmark: true,
          },
        ]}
        isLoading={false}
      />,
    );

    expect(screen.getByText('ノートA')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /口コミ/ }));
    expect(screen.getByText('口コミA')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /保存 \(1\)/ }));
    expect(screen.getByText('保存済みノート')).toBeInTheDocument();
  });
});
