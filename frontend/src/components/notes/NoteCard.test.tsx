import { render, screen } from '@testing-library/react';
import NoteCard from '@/components/notes/NoteCard';
import type { NoteListItem } from '@/types/offering';

describe('NoteCard', () => {
  const baseNote: NoteListItem = {
    id: 'note-1',
    title: '線形代数ノート',
    body: '本文',
    imageUrl: null,
    createdAt: '2026-02-01T10:00:00.000Z',
    authorId: 'author-1',
    authorName: '山田 太郎',
    authorAvatarUrl: 'https://example.com/avatar.png',
    likesCount: 0,
    bookmarksCount: 0,
    commentsCount: 0,
    isLikedByMe: false,
    isBookmarkedByMe: false,
  };

  it('links author avatar and name to profile page', () => {
    render(
      <NoteCard
        offeringId="offering-1"
        note={baseNote}
        onToggleLike={jest.fn().mockResolvedValue(undefined)}
        onToggleBookmark={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(4);
    expect(links[0]).toHaveAttribute('href', '/profile/author-1');
    expect(links[1]).toHaveAttribute('href', '/profile/author-1');
    expect(links[2]).toHaveAttribute('href', '/offerings/offering-1/notes/note-1');
    expect(links[3]).toHaveAttribute('href', '/offerings/offering-1/notes/note-1');
  });

  it('links self-authored notes to /me', () => {
    render(
      <NoteCard
        offeringId="offering-1"
        note={baseNote}
        currentUserId="author-1"
        onToggleLike={jest.fn().mockResolvedValue(undefined)}
        onToggleBookmark={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', '/me');
    expect(links[1]).toHaveAttribute('href', '/me');
  });
});
