import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import { createSupabaseClient } from '@/lib/supabase/client';
import {
  DEFAULT_GLOBAL_TIMETABLE_CONFIG,
  loadEffectiveTimetableConfig,
} from '@/lib/timetable/config';
import { updateEnrollmentStatus } from '@/lib/timetable/enrollment';
import {
  TIMETABLE_HIGHLIGHT_STORAGE_KEY,
  TIMETABLE_SCROLL_STORAGE_KEY,
} from '@/lib/timetable/add';
import TimetableGrid from './TimetableGrid';

jest.mock('@/lib/supabase/client', () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock('@/lib/timetable/enrollment', () => ({
  updateEnrollmentStatus: jest.fn(),
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

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ push: mockPush })),
  usePathname: jest.fn(() => '/timetable'),
}));

type TimetableRow = {
  created_at: string;
  status: 'enrolled' | 'planned' | 'dropped';
  offering: {
    id: string;
    instructor: string | null;
    courses: { id: string; name: string };
    terms?: { id: string; year: number; season: string; start_date: string | null; end_date: string | null };
    offering_slots: Array<{ day_of_week: number; period: number; start_time: string | null }>;
  };
};

const loadEffectiveTimetableConfigMock = loadEffectiveTimetableConfig as jest.Mock;
const updateEnrollmentStatusMock = updateEnrollmentStatus as jest.Mock;

describe('TimetableGrid', () => {
  const mockGetUser = jest.fn();
  const mockProfilesMaybeSingle = jest.fn();
  const mockTermsEq = jest.fn();
  const mockEnrollmentsIn = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    window.sessionStorage.clear();
    window.scrollTo = jest.fn();

    loadEffectiveTimetableConfigMock.mockResolvedValue({
      config: DEFAULT_GLOBAL_TIMETABLE_CONFIG,
      presetId: 'preset-1',
      source: 'user',
    });

    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockProfilesMaybeSingle.mockResolvedValue({ data: { university_id: 'uni-1' }, error: null });
    mockTermsEq.mockResolvedValue({
      data: [{ id: 'term-current', year: 2026, season: 'first_half', start_date: null, end_date: null }],
      error: null,
    });
    mockEnrollmentsIn.mockResolvedValue({ data: [], error: null });
    updateEnrollmentStatusMock.mockResolvedValue({
      success: true,
      row: {
        offering_id: 'offering-1',
        previous_status: 'enrolled',
        status: 'dropped',
        visibility: 'match_only',
        was_inserted: false,
      },
      alreadyActive: false,
      wasReactivated: false,
    });

    (createSupabaseClient as jest.Mock).mockReturnValue({
      auth: { getUser: mockGetUser },
      from: jest.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({ maybeSingle: mockProfilesMaybeSingle })),
            })),
          };
        }

        if (table === 'terms') {
          return {
            select: jest.fn(() => ({
              eq: mockTermsEq,
            })),
          };
        }

        if (table === 'enrollments') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                in: mockEnrollmentsIn,
              })),
            })),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
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

  it('routes empty cell clicks to the timetable add page with slot context', async () => {
    render(<TimetableGrid />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: '空きコマ' }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: '空きコマ' })[0]);

    expect(mockPush).toHaveBeenCalledWith('/timetable/add?termId=term-current&day=mon&period=1&returnTo=%2Ftimetable');
  });

  it('routes occupied cell add actions to the timetable add page', async () => {
    mockEnrollmentsIn.mockResolvedValue({
      data: [
        {
          created_at: '2026-02-17T00:00:00.000Z',
          status: 'enrolled',
          offering: {
            id: 'offering-b',
            instructor: '佐藤 花',
            courses: { id: 'course-b', name: '線形代数' },
            offering_slots: [{ day_of_week: 2, period: 3, start_time: '13:10:00' }],
          },
        },
      ] satisfies TimetableRow[],
      error: null,
    });

    render(<TimetableGrid />);

    await waitFor(() => {
      expect(screen.getAllByText('線形代数').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'このコマに授業を追加' })[0]);

    expect(mockPush).toHaveBeenCalledWith('/timetable/add?termId=term-current&day=tue&period=3&returnTo=%2Ftimetable');
  });

  it('restores scroll position and highlights out-of-config items from session storage', async () => {
    window.sessionStorage.setItem(TIMETABLE_SCROLL_STORAGE_KEY, '420');
    window.sessionStorage.setItem(
      TIMETABLE_HIGHLIGHT_STORAGE_KEY,
      JSON.stringify({
        offeringId: 'offering-x',
        dayOfWeek: 2,
        period: 3,
        outOfConfig: true,
      }),
    );

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
      ] satisfies TimetableRow[],
      error: null,
    });

    render(<TimetableGrid />);

    await waitFor(() => {
      expect(screen.getByText('設定外の授業が 1 件あります。設定を見直してください。')).toBeInTheDocument();
      expect(window.scrollTo).toHaveBeenCalledWith({ top: 420, behavior: 'auto' });
    });

    expect(screen.getByText('線形代数 / 火曜 3限')).toHaveClass('font-semibold');
  });

  it('removes an offering from the visible timetable after confirmation', async () => {
    mockEnrollmentsIn.mockResolvedValue({
      data: [
        {
          created_at: '2026-02-17T00:00:00.000Z',
          status: 'enrolled',
          offering: {
            id: 'offering-1',
            instructor: '山田 太郎',
            courses: { id: 'course-1', name: 'データベース概論' },
            offering_slots: [{ day_of_week: 1, period: 1, start_time: '09:00:00' }],
          },
        },
      ] satisfies TimetableRow[],
      error: null,
    });

    render(<TimetableGrid />);

    await waitFor(() => {
      expect(screen.getAllByText('データベース概論').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: '時間割から削除' })[0]);
    expect(screen.getByRole('dialog', { name: '時間割から外す' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '時間割から外す' }));

    await waitFor(() => {
      expect(updateEnrollmentStatusMock).toHaveBeenCalledWith(expect.anything(), {
        offeringId: 'offering-1',
        status: 'dropped',
      });
      expect(screen.queryByText('データベース概論')).not.toBeInTheDocument();
      expect(toast.success).toHaveBeenCalledWith('時間割から外しました');
    });
  });

  it('shows dropped offerings and allows restoring them when the toggle is enabled', async () => {
    mockEnrollmentsIn.mockResolvedValue({
      data: [
        {
          created_at: '2026-02-17T00:00:00.000Z',
          status: 'dropped',
          offering: {
            id: 'offering-2',
            instructor: '佐藤 花',
            courses: { id: 'course-2', name: '統計学' },
            offering_slots: [{ day_of_week: 2, period: 2, start_time: '10:45:00' }],
          },
        },
      ] satisfies TimetableRow[],
      error: null,
    });
    updateEnrollmentStatusMock.mockResolvedValue({
      success: true,
      row: {
        offering_id: 'offering-2',
        previous_status: 'dropped',
        status: 'enrolled',
        visibility: 'match_only',
        was_inserted: false,
      },
      alreadyActive: false,
      wasReactivated: true,
    });

    render(<TimetableGrid />);

    expect(screen.queryByText('統計学')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: '取消を表示' }));

    await waitFor(() => {
      expect(screen.getAllByText('統計学').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: '時間割へ再登録' })[0]);
    expect(screen.getByRole('dialog', { name: '時間割に戻す' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '再登録する' }));

    await waitFor(() => {
      expect(updateEnrollmentStatusMock).toHaveBeenCalledWith(expect.anything(), {
        offeringId: 'offering-2',
        status: 'enrolled',
      });
      expect(screen.getAllByText('履修中').length).toBeGreaterThan(0);
      expect(toast.success).toHaveBeenCalledWith('時間割に再登録しました');
    });
  });
});
