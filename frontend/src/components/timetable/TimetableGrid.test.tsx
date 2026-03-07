import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createSupabaseClient } from '@/lib/supabase/client';
import {
  DEFAULT_GLOBAL_TIMETABLE_CONFIG,
  loadEffectiveTimetableConfig,
} from '@/lib/timetable/config';
import TimetableGrid from './TimetableGrid';

jest.mock('@/lib/supabase/client', () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock('@/lib/timetable/config', () => ({
  DEFAULT_GLOBAL_TIMETABLE_CONFIG: {
    weekdays: [1, 2, 3, 4, 5],
    periods: [
      { period: 1, label: '1限', startTime: '09:00', endTime: '10:40' },
      { period: 2, label: '2限', startTime: '10:45', endTime: '12:25' },
      { period: 3, label: '3限', startTime: '13:10', endTime: '14:50' },
    ],
  },
  loadEffectiveTimetableConfig: jest.fn(),
  formatWeekdayLabel: jest.fn((day: number) => ['?', '月', '火', '水', '木', '金', '土', '日'][day] ?? '?'),
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

const loadEffectiveTimetableConfigMock = loadEffectiveTimetableConfig as jest.Mock;

describe('TimetableGrid', () => {
  const mockGetUser = jest.fn();
  const mockProfilesMaybeSingle = jest.fn();
  const mockEnrollmentsIn = jest.fn();
  const mockProfilesEq = jest.fn(() => ({ maybeSingle: mockProfilesMaybeSingle }));
  const mockEnrollmentsEq = jest.fn(() => ({ in: mockEnrollmentsIn }));
  const mockSelect = jest.fn();
  const mockFrom = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    loadEffectiveTimetableConfigMock.mockResolvedValue({
      config: DEFAULT_GLOBAL_TIMETABLE_CONFIG,
      presetId: 'preset-1',
      source: 'user',
    });

    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockProfilesMaybeSingle.mockResolvedValue({ data: { university_id: 'uni-1' }, error: null });

    mockSelect.mockImplementation((selectClause: string) => {
      if (selectClause.includes('university_id')) {
        return { eq: mockProfilesEq };
      }
      return { eq: mockEnrollmentsEq };
    });

    mockFrom.mockImplementation(() => ({ select: mockSelect }));

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

  it('renders enrolled offerings in timetable cells using configured periods', async () => {
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

    mockEnrollmentsIn.mockResolvedValue({ data: rows, error: null });

    render(<TimetableGrid />);

    await waitFor(() => {
      expect(screen.getAllByText('Webプログラミング').length).toBeGreaterThan(0);
      expect(screen.getAllByText('田中 健太').length).toBeGreaterThan(0);
      expect(screen.getAllByText('13:10').length).toBeGreaterThan(0);
      expect(screen.getAllByText('3限').length).toBeGreaterThan(0);
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

    mockEnrollmentsIn.mockImplementation((_column: string, statuses: string[]) =>
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

    mockEnrollmentsIn.mockResolvedValue({ data: rows, error: null });

    render(<TimetableGrid />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: '重複している授業を表示' }).length).toBeGreaterThan(0);
      expect(screen.getAllByText('+1').length).toBeGreaterThan(0);
    });
  });

  it('shows warning when offerings exist outside configured timetable slots', async () => {
    loadEffectiveTimetableConfigMock.mockResolvedValue({
      config: {
        weekdays: [1, 2, 3, 4, 5],
        periods: [{ period: 1, label: '1限', startTime: '09:00', endTime: '10:40' }],
      },
      presetId: 'preset-1',
      source: 'user',
    });

    mockEnrollmentsIn.mockResolvedValue({
      data: [
        {
          created_at: '2026-02-17T00:00:00.000Z',
          status: 'enrolled',
          offering: {
            id: 'offering-x',
            instructor: '教師',
            courses: { id: 'course-x', name: '線形代数' },
            offering_slots: [{ day_of_week: 2, period: 3, start_time: null }],
          },
        },
      ],
      error: null,
    });

    render(<TimetableGrid />);

    await waitFor(() => {
      expect(screen.getByText('設定外の授業が 1 件あります。設定を見直してください。')).toBeInTheDocument();
      expect(screen.getByText('線形代数 / 火曜 3限')).toBeInTheDocument();
    });
  });
});
