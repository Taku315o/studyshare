import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createSupabaseClient } from '@/lib/supabase/client';
import TimetableGrid from './TimetableGrid';

jest.mock('@/lib/supabase/client', () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn().mockReturnValue({ push: jest.fn() }),
}));

type TimetableRow = {
  created_at: string;
  status: 'enrolled' | 'planned' | 'dropped';
  offering: {
    id: string;
    instructor: string | null;
    courses: { id: string; name: string };
    offering_slots: Array<{ day_of_week: number; period: number; start_time: string | null }>;
  };
};

describe('TimetableGrid', () => {
  const mockGetUser = jest.fn();
  const mockIn = jest.fn();
  const mockEq = jest.fn(() => ({ in: mockIn }));
  const mockSelect = jest.fn(() => ({ eq: mockEq }));
  const mockFrom = jest.fn(() => ({ select: mockSelect }));

  beforeEach(() => {
    jest.clearAllMocks();
    (createSupabaseClient as jest.Mock).mockReturnValue({
      auth: { getUser: mockGetUser },
      from: mockFrom,
    });
  });

  it('shows loading state while timetable is being fetched', () => {
    mockGetUser.mockReturnValue(new Promise(() => {}));

    render(<TimetableGrid />);

    expect(screen.getByText('時間割を読み込み中...')).toBeInTheDocument();
  });

  it('renders enrolled offerings in timetable cells', async () => {
    const rows: TimetableRow[] = [
      {
        created_at: '2026-02-17T00:00:00.000Z',
        status: 'enrolled',
        offering: {
          id: 'offering-a',
          instructor: '田中 健太',
          courses: { id: 'course-a', name: 'Webプログラミング' },
          offering_slots: [{ day_of_week: 2, period: 3, start_time: '13:10:00' }],
        },
      },
    ];

    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockIn.mockResolvedValue({ data: rows, error: null });

    render(<TimetableGrid />);

    await waitFor(() => {
      expect(screen.getAllByText('Webプログラミング').length).toBeGreaterThan(0);
      expect(screen.getAllByText('田中 健太').length).toBeGreaterThan(0);
      expect(screen.getAllByText('13:10').length).toBeGreaterThan(0);
    });
  });

  it('hides dropped offerings by default and shows them when toggle is enabled', async () => {
    const droppedRow: TimetableRow = {
      created_at: '2026-02-17T00:00:00.000Z',
      status: 'dropped',
      offering: {
        id: 'offering-d',
        instructor: '佐々木 花',
        courses: { id: 'course-d', name: '機械学習入門' },
        offering_slots: [{ day_of_week: 1, period: 1, start_time: '09:00:00' }],
      },
    };

    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockIn.mockImplementation((_column: string, statuses: string[]) =>
      Promise.resolve({
        data: statuses.includes('dropped') ? [droppedRow] : [],
        error: null,
      }),
    );

    render(<TimetableGrid />);

    await waitFor(() => {
      expect(screen.queryByText('機械学習入門')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('checkbox', { name: '取消を表示' }));

    await waitFor(() => {
      expect(screen.getAllByText('機械学習入門').length).toBeGreaterThan(0);
      expect(screen.getAllByText('取消').length).toBeGreaterThan(0);
    });
  });

  it('shows overlap badge when multiple offerings share the same slot', async () => {
    const rows: TimetableRow[] = [
      {
        created_at: '2026-02-16T00:00:00.000Z',
        status: 'enrolled',
        offering: {
          id: 'offering-1',
          instructor: '山田 太郎',
          courses: { id: 'course-1', name: '統計学' },
          offering_slots: [{ day_of_week: 3, period: 2, start_time: '10:45:00' }],
        },
      },
      {
        created_at: '2026-02-17T00:00:00.000Z',
        status: 'planned',
        offering: {
          id: 'offering-2',
          instructor: '鈴木 一郎',
          courses: { id: 'course-2', name: '情報倫理' },
          offering_slots: [{ day_of_week: 3, period: 2, start_time: '10:45:00' }],
        },
      },
    ];

    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockIn.mockResolvedValue({ data: rows, error: null });

    render(<TimetableGrid />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: '重複している授業を表示' }).length).toBeGreaterThan(0);
      expect(screen.getAllByText('+1').length).toBeGreaterThan(0);
    });
  });
});
