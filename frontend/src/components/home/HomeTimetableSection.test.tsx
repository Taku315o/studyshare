import { render, screen } from '@testing-library/react';
import { useTimetableGridData } from '@/components/timetable/useTimetableGridData';
import { createSupabaseClient } from '@/lib/supabase/client';
import HomeTimetableSection from './HomeTimetableSection';

jest.mock('@/lib/supabase/client', () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock('@/components/timetable/useTimetableGridData', () => ({
  useTimetableGridData: jest.fn(),
}));

const createSupabaseClientMock = createSupabaseClient as jest.Mock;
const useTimetableGridDataMock = useTimetableGridData as jest.Mock;

describe('HomeTimetableSection', () => {
  const supabaseClient = { auth: {}, from: jest.fn(), rpc: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    createSupabaseClientMock.mockReturnValue(supabaseClient);
    useTimetableGridDataMock.mockReturnValue({
      enrollmentEntries: [],
      terms: [
        {
          id: 'term-1',
          academicYear: 2026,
          code: 'first_half',
          displayName: '前期',
          sortKey: 10,
          startDate: '2026-04-01',
          endDate: '2026-08-01',
        },
      ],
      timetableConfig: {
        weekdays: [1, 2, 3, 4, 5],
        periods: [{ period: 1, label: '1限', startTime: '09:00', endTime: '10:40' }],
      },
      isLoading: false,
      errorMessage: null,
      resolvedTermId: 'term-1',
      updateEnrollmentStatusLocally: jest.fn(),
    });
  });

  it('uses timetable grid data with the home-specific defaults', () => {
    render(<HomeTimetableSection />);

    expect(useTimetableGridDataMock).toHaveBeenCalledWith({
      rawSelectedTermId: null,
      showDropped: false,
      supabase: supabaseClient,
    });
  });

  it('renders the resolved term label through WeeklyTimetable', () => {
    render(<HomeTimetableSection />);

    expect(screen.getByText('表示中: 2026 前期')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '時間割を見る' })).toHaveAttribute('href', '/timetable');
  });

  it('renders the hook error state inside the timetable card', () => {
    useTimetableGridDataMock.mockReturnValue({
      enrollmentEntries: [],
      terms: [],
      timetableConfig: {
        weekdays: [1, 2, 3, 4, 5],
        periods: [{ period: 1, label: '1限', startTime: '09:00', endTime: '10:40' }],
      },
      isLoading: false,
      errorMessage: '時間割の取得に失敗しました。しばらくしてから再度お試しください。',
      resolvedTermId: null,
      updateEnrollmentStatusLocally: jest.fn(),
    });

    render(<HomeTimetableSection />);

    expect(screen.getByText('時間割の取得に失敗しました。しばらくしてから再度お試しください。')).toBeInTheDocument();
  });
});
