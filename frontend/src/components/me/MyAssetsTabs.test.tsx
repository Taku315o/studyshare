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
        savedNotes={[]}
        isLoading={false}
      />,
    );

    expect(screen.getByText('ノートA')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /口コミ/ }));
    expect(screen.getByText('口コミA')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /保存/ }));
    expect(screen.getByText('いいね・ブックマークしたノートはありません。')).toBeInTheDocument();
  });

  it('shows saved notes in the saved tab', async () => {
    const user = userEvent.setup();

    render(
      <MyAssetsTabs
        notes={[]}
        reviews={[]}
        savedNotes={[
          {
            id: 'note-2',
            title: '保存ノートB',
            body: '本文B',
            createdAt: '2026-02-18T10:00:00.000Z',
            offeringId: 'offering-1',
            offeringTitle: '応用プログラミング3',
            instructorName: '田中先生',
            authorName: '山田太郎',
            isLikedByMe: true,
            isBookmarkedByMe: false,
          },
        ]}
        isLoading={false}
      />,
    );

    await user.click(screen.getByRole('button', { name: /保存/ }));
    expect(screen.getByText('保存ノートB')).toBeInTheDocument();
    expect(screen.getByText('いいね済み')).toBeInTheDocument();
  });
});
