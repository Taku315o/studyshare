import { render, screen } from '@testing-library/react';
import MySavedNotesList from './MySavedNotesList';

describe('MySavedNotesList', () => {
  it('renders loading skeleton while loading', () => {
    render(<MySavedNotesList savedNotes={[]} isLoading />);

    expect(screen.getAllByTestId('my-saved-note-skeleton')).toHaveLength(2);
  });

  it('renders empty state when no saved notes', () => {
    render(<MySavedNotesList savedNotes={[]} isLoading={false} />);

    expect(screen.getByText('保存したノートはまだありません。')).toBeInTheDocument();
  });

  it('renders like and bookmark badges when both are saved', () => {
    render(
      <MySavedNotesList
        isLoading={false}
        savedNotes={[
          {
            id: 'saved-note-1',
            title: '保存ノート',
            body: '本文',
            createdAt: '2026-02-10T09:00:00.000Z',
            offeringTitle: '応用数学',
            instructorName: '田中先生',
            savedAt: '2026-02-20T10:00:00.000Z',
            savedByLike: true,
            savedByBookmark: true,
          },
        ]}
      />,
    );

    expect(screen.getByText('保存ノート')).toBeInTheDocument();
    expect(screen.getByText('いいね済み')).toBeInTheDocument();
    expect(screen.getByText('ブックマーク済み')).toBeInTheDocument();
  });
});
