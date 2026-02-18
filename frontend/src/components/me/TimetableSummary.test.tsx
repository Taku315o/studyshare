import { render, screen } from '@testing-library/react';
import TimetableSummary from './TimetableSummary';

describe('TimetableSummary', () => {
  it('shows empty state when there are no classes today', () => {
    render(
      <TimetableSummary
        isLoading={false}
        summary={{
          termLabel: '2026 前期',
          currentTermEnrollmentCount: 2,
          todayClasses: [],
        }}
      />,
    );

    expect(screen.getByText('今日の授業はありません。')).toBeInTheDocument();
  });

  it('renders class list when classes exist today', () => {
    render(
      <TimetableSummary
        isLoading={false}
        summary={{
          termLabel: '2026 前期',
          currentTermEnrollmentCount: 2,
          todayClasses: [
            {
              offeringId: 'offering-1',
              courseTitle: '応用プログラミング3',
              instructorName: '田中先生',
              period: 2,
              startTime: '10:45',
              status: 'enrolled',
            },
            {
              offeringId: 'offering-2',
              courseTitle: 'データ構造',
              instructorName: '佐藤先生',
              period: 4,
              startTime: '14:55',
              status: 'planned',
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('応用プログラミング3')).toBeInTheDocument();
    expect(screen.getByText('データ構造')).toBeInTheDocument();
  });
});
