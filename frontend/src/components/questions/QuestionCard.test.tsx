import { render, screen } from '@testing-library/react';
import QuestionCard from './QuestionCard';
import type { QuestionListItem } from '@/types/offering';

describe('QuestionCard', () => {
  const baseQuestion: QuestionListItem = {
    id: 'question-1',
    title: 'レポートの締切はいつですか？',
    body: 'シラバス上の締切とLMSの締切が違って見えます。',
    createdAt: '2026-03-01T10:00:00.000Z',
    authorId: 'author-1',
    authorName: '山田 花子',
    authorAvatarUrl: null,
    authorAllowDm: true,
    answersCount: 3,
  };

  it('links title and CTA to question detail page', () => {
    render(<QuestionCard offeringId="offering-1" question={baseQuestion} />);

    const detailLinks = screen.getAllByRole('link', { name: /レポートの締切はいつですか？|回答する/ });
    expect(detailLinks).toHaveLength(2);
    expect(detailLinks[0]).toHaveAttribute('href', '/offerings/offering-1/questions/question-1');
    expect(detailLinks[1]).toHaveAttribute('href', '/offerings/offering-1/questions/question-1');
    expect(screen.getByText(/^3$/)).toBeInTheDocument();
  });
});
