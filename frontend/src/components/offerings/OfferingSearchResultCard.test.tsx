import { render, screen } from '@testing-library/react';
import OfferingSearchResultCard from './OfferingSearchResultCard';

const result = {
  offeringId: 'offering-1',
  courseTitle: 'マーケティング',
  courseCode: null,
  instructorName: '大崎恒次',
  room: '302',
  slotLabels: ['月曜 1限'],
  slotDetails: [{ dayOfWeek: 1 as const, period: 1, room: '302' }],
  slotMatch: true,
  enrollmentCount: 2,
  myStatus: null,
  createdAt: '2026-03-01T00:00:00.000Z',
};

describe('OfferingSearchResultCard', () => {
  it('shows only detail CTA in browse mode', () => {
    render(<OfferingSearchResultCard mode="browse" result={result} detailHref="/offerings/offering-1" />);

    expect(screen.getByRole('link', { name: '詳細を見る' })).toHaveAttribute('href', '/offerings/offering-1');
    expect(screen.queryByRole('button', { name: '登録' })).not.toBeInTheDocument();
    expect(screen.queryByText('このコマに一致')).not.toBeInTheDocument();
  });

  it('shows register and detail CTAs in timetable-add mode', () => {
    render(<OfferingSearchResultCard mode="timetable-add" result={result} detailHref="/offerings/offering-1" />);

    expect(screen.getByRole('link', { name: '詳細を見る' })).toHaveAttribute('href', '/offerings/offering-1');
    expect(screen.getByRole('button', { name: '登録' })).toBeInTheDocument();
    expect(screen.getByText('このコマに一致')).toBeInTheDocument();
  });

  it('hides slot-match badge in browse mode even when slotMatch is true', () => {
    render(<OfferingSearchResultCard mode="browse" result={result} detailHref="/offerings/offering-1" />);

    expect(screen.queryByText('このコマに一致')).not.toBeInTheDocument();
  });
});
