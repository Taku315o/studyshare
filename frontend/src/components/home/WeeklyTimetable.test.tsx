import { render, screen } from '@testing-library/react';
import WeeklyTimetable from './WeeklyTimetable';

describe('WeeklyTimetable', () => {
  const timetableConfig = {
    weekdays: [1, 2, 5] as const,
    periods: [
      { period: 1, label: '1限', startTime: '09:00', endTime: '10:40' },
      { period: 3, label: '3限', startTime: '13:10', endTime: '14:50' },
    ],
  };

  it('renders configured slots, overlap badges, and hidden-offering summary', () => {
    render(
      <WeeklyTimetable
        timetableConfig={timetableConfig}
        termLabel="2026 前期"
        isLoading={false}
        errorMessage={null}
        enrollmentEntries={[
          {
            offeringId: 'offering-1',
            termId: 'term-1',
            courseTitle: 'Webプログラミング',
            instructorName: '田中 健太',
            colorToken: 'sky',
            createdAt: '2026-03-01T09:00:00.000Z',
            status: 'enrolled',
            slots: [{ dayOfWeek: 1, period: 1, startTime: '09:00' }],
            isUnslotted: false,
            room: null,
          },
          {
            offeringId: 'offering-2',
            termId: 'term-1',
            courseTitle: '線形代数学',
            instructorName: '佐藤 一郎',
            colorToken: 'amber',
            createdAt: '2026-03-02T09:00:00.000Z',
            status: 'planned',
            slots: [{ dayOfWeek: 1, period: 1, startTime: '09:00' }],
            isUnslotted: false,
            room: null,
          },
          {
            offeringId: 'offering-3',
            termId: 'term-1',
            courseTitle: '統計学',
            instructorName: '伊藤 花',
            colorToken: 'rose',
            createdAt: '2026-03-03T09:00:00.000Z',
            status: 'enrolled',
            slots: [{ dayOfWeek: 6, period: 1, startTime: '09:00' }],
            isUnslotted: false,
            room: null,
          },
          {
            offeringId: 'offering-4',
            termId: 'term-1',
            courseTitle: '経営学',
            instructorName: '高橋 陽',
            colorToken: 'teal',
            createdAt: '2026-03-04T09:00:00.000Z',
            status: 'enrolled',
            slots: [],
            isUnslotted: true,
            room: null,
          },
        ]}
      />,
    );

    expect(screen.getByText('表示中: 2026 前期')).toBeInTheDocument();
    expect(screen.getByText('月')).toBeInTheDocument();
    expect(screen.getByText('火')).toBeInTheDocument();
    expect(screen.getByText('金')).toBeInTheDocument();
    expect(screen.getByText('1限')).toBeInTheDocument();
    expect(screen.getByText('3限')).toBeInTheDocument();
    expect(screen.getByText('Webプログラミング')).toBeInTheDocument();
    expect(screen.getByText('田中 健太')).toBeInTheDocument();
    expect(screen.getByText('09:00 - 10:40')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(screen.getByText('時間未設定/設定外の授業 2 件')).toBeInTheDocument();
  });

  it('shows loading state while the timetable is being fetched', () => {
    render(
      <WeeklyTimetable
        timetableConfig={timetableConfig}
        termLabel={null}
        isLoading
        errorMessage={null}
        enrollmentEntries={[]}
      />,
    );

    expect(screen.getByText('時間割を読み込み中...')).toBeInTheDocument();
  });

  it('shows error state without breaking the card layout', () => {
    render(
      <WeeklyTimetable
        timetableConfig={timetableConfig}
        termLabel="2026 前期"
        isLoading={false}
        errorMessage="時間割の取得に失敗しました。しばらくしてから再度お試しください。"
        enrollmentEntries={[]}
      />,
    );

    expect(screen.getByText('時間割の取得に失敗しました。しばらくしてから再度お試しください。')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '時間割を見る' })).toHaveAttribute('href', '/timetable');
  });

  it('shows empty state and CTA when there are no visible classes', () => {
    render(
      <WeeklyTimetable
        timetableConfig={timetableConfig}
        termLabel="2026 前期"
        isLoading={false}
        errorMessage={null}
        enrollmentEntries={[]}
      />,
    );

    expect(screen.getByText('表示中の学期に、ホームで表示できる授業はまだありません。')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '時間割で確認する' })).toHaveAttribute('href', '/timetable');
  });
});
