import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import { createSupabaseClient } from '@/lib/supabase/client';
import { DEFAULT_GLOBAL_TIMETABLE_CONFIG, loadEffectiveTimetableConfig } from '@/lib/timetable/config';
import { updateEnrollmentStatus } from '@/lib/timetable/enrollment';
import { TIMETABLE_HIGHLIGHT_STORAGE_KEY, TIMETABLE_SCROLL_STORAGE_KEY } from '@/lib/timetable/add';
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
const mockReplace = jest.fn();
let queryString = 'termId=term-current';

const mockRouter = { push: mockPush, replace: mockReplace };

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => mockRouter),
  usePathname: jest.fn(() => '/timetable'),
  useSearchParams: jest.fn(() => new URLSearchParams(queryString)),
}));

type TimetableRpcRow = {
  term_id: string;
  term_academic_year: number;
  term_code: string;
  term_display_name: string;
  term_sort_key: number;
  offering_id: string;
  course_title: string | null;
  instructor: string | null;
  status: 'enrolled' | 'planned' | 'dropped';
  created_at: string;
  day_of_week: number | null;
  period: number | null;
  start_time: string | null;
  room: string | null;
  is_unslotted: boolean;
};

const loadEffectiveTimetableConfigMock = loadEffectiveTimetableConfig as jest.Mock;
const updateEnrollmentStatusMock = updateEnrollmentStatus as jest.Mock;

describe('TimetableGrid', () => {
  const mockGetUser = jest.fn();
  const mockProfilesMaybeSingle = jest.fn();
  const mockTermsEq = jest.fn();
  const mockRpc = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    queryString = 'termId=term-current';
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
      data: [
        {
          id: 'term-current',
          academic_year: 2026,
          code: 'first_half',
          display_name: '前期',
          sort_key: 10,
          start_date: '2026-04-01',
          end_date: '2026-08-01',
        },
        {
          id: 'term-next',
          academic_year: 2026,
          code: 'second_half',
          display_name: '後期',
          sort_key: 20,
          start_date: '2026-09-15',
          end_date: '2027-01-31',
        },
      ],
      error: null,
    });
    mockRpc.mockResolvedValue({ data: [], error: null });
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
      rpc: mockRpc,
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

        throw new Error(`Unexpected table: ${table}`);
      }),
    });
  });

  it('shows loading state while timetable is being fetched', () => {
    mockGetUser.mockReturnValue(new Promise(() => { }));

    render(<TimetableGrid />);

    expect(screen.getByText('時間割を読み込み中...')).toBeInTheDocument();
  });

  it('renders selected term enrollments in timetable cells', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          term_id: 'term-current',
          term_academic_year: 2026,
          term_code: 'first_half',
          term_display_name: '前期',
          term_sort_key: 10,
          offering_id: 'offering-a',
          course_title: 'Webプログラミング',
          instructor: '田中 健太',
          status: 'enrolled',
          created_at: '2026-02-17T00:00:00.000Z',
          day_of_week: 2,
          period: 3,
          start_time: '13:10:00',
          room: '302',
          is_unslotted: false,
        },
      ] satisfies TimetableRpcRow[],
      error: null,
    });

    render(<TimetableGrid />);

    await waitFor(() => {
      expect(screen.getAllByText('Webプログラミング').length).toBeGreaterThan(0);
      expect(screen.getAllByText('田中 健太').length).toBeGreaterThan(0);
      expect(screen.getAllByText('13:10').length).toBeGreaterThan(0);
      expect(screen.getByText('2026 前期')).toBeInTheDocument();
    });

    expect(mockRpc).toHaveBeenCalledWith('list_my_timetable', {
      _term_id: 'term-current',
      _include_dropped: false,
    });
  });

  it('updates the route when the selected term changes via modal', async () => {
    render(<TimetableGrid />);

    await waitFor(() => {
      expect(screen.getByText('2026 前期')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('2026 前期'));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: '年度・学期切替' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('後期'));
    fireEvent.click(screen.getByRole('button', { name: '変更する' }));

    expect(mockReplace).toHaveBeenCalledWith('/timetable?termId=term-next');
  });

  it('routes empty cell clicks to the timetable add page with selected term context', async () => {
    render(<TimetableGrid />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: '空きコマ' }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: '空きコマ' })[0]);

    expect(mockPush).toHaveBeenCalledWith('/timetable/add?termId=term-current&day=mon&period=1&returnTo=%2Ftimetable%3FtermId%3Dterm-current');
  });

  it('restores scroll position and highlights out-of-config items from session storage', async () => {
    window.sessionStorage.setItem(TIMETABLE_SCROLL_STORAGE_KEY, '420');
    window.sessionStorage.setItem(
      TIMETABLE_HIGHLIGHT_STORAGE_KEY,
      JSON.stringify({
        offeringId: 'offering-x',
        dayOfWeek: 2,
        period: 3,
        location: 'out_of_config',
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

    mockRpc.mockResolvedValue({
      data: [
        {
          term_id: 'term-current',
          term_academic_year: 2026,
          term_code: 'first_half',
          term_display_name: '前期',
          term_sort_key: 10,
          offering_id: 'offering-x',
          course_title: '線形代数',
          instructor: '教師',
          status: 'enrolled',
          created_at: '2026-02-17T00:00:00.000Z',
          day_of_week: 2,
          period: 3,
          start_time: null,
          room: null,
          is_unslotted: false,
        },
      ] satisfies TimetableRpcRow[],
      error: null,
    });

    render(<TimetableGrid />);

    await waitFor(() => {
      expect(screen.getByText('設定外の授業が 1 件あります。設定を見直してください。')).toBeInTheDocument();
      expect(window.scrollTo).toHaveBeenCalledWith({ top: 420, behavior: 'auto' });
    });

    expect(screen.getByText('線形代数 / 火曜 3限')).toHaveClass('font-semibold');
  });

  it('renders every configured period when timetable settings include ten periods', async () => {
    loadEffectiveTimetableConfigMock.mockResolvedValue({
      config: {
        weekdays: [1, 2, 3, 4, 5],
        periods: Array.from({ length: 10 }, (_, index) => ({
          period: index + 1,
          label: `${index + 1}限`,
          startTime: '08:45',
          endTime: '09:30',
        })),
      },
      presetId: 'preset-hiroshima',
      source: 'user',
    });

    render(<TimetableGrid />);

    await waitFor(() => {
      expect(screen.getAllByText('10限').length).toBeGreaterThan(0);
    });
  });

  it('shows unslotted offerings in a dedicated section', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          term_id: 'term-current',
          term_academic_year: 2026,
          term_code: 'full_year',
          term_display_name: '通年',
          term_sort_key: 50,
          offering_id: 'offering-u',
          course_title: '集中講義',
          instructor: '特別講師',
          status: 'enrolled',
          created_at: '2026-02-17T00:00:00.000Z',
          day_of_week: null,
          period: null,
          start_time: null,
          room: '講堂',
          is_unslotted: true,
        },
      ] satisfies TimetableRpcRow[],
      error: null,
    });

    render(<TimetableGrid />);

    await waitFor(() => {
      expect(screen.getByText('集中・日時未定')).toBeInTheDocument();
      expect(screen.getByText('集中講義')).toBeInTheDocument();
    });
  });

  it('removes an offering from the visible timetable after confirmation', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          term_id: 'term-current',
          term_academic_year: 2026,
          term_code: 'first_half',
          term_display_name: '前期',
          term_sort_key: 10,
          offering_id: 'offering-1',
          course_title: 'データベース概論',
          instructor: '山田 太郎',
          status: 'enrolled',
          created_at: '2026-02-17T00:00:00.000Z',
          day_of_week: 1,
          period: 1,
          start_time: '09:00:00',
          room: null,
          is_unslotted: false,
        },
      ] satisfies TimetableRpcRow[],
      error: null,
    });

    render(<TimetableGrid />);

    await waitFor(() => {
      expect(screen.getAllByText('データベース概論').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: '時間割から取り消し' })[0]);
    expect(screen.getByRole('dialog', { name: '時間割から外す' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '時間割から外す' }));

    await waitFor(() => {
      expect(updateEnrollmentStatusMock).toHaveBeenCalledWith(expect.anything(), {
        offeringId: 'offering-1',
        status: 'dropped',
      });
      expect(screen.queryAllByText('データベース概論').length).toBe(0);
      expect(toast.success).toHaveBeenCalledWith('時間割から外しました');
    });
  });

  it('shows dropped offerings and allows restoring them when the toggle is enabled', async () => {
    mockRpc.mockImplementation((_fn: string, args: { _include_dropped: boolean }) =>
      Promise.resolve({
        data: args._include_dropped
          ? [
            {
              term_id: 'term-current',
              term_academic_year: 2026,
              term_code: 'first_half',
              term_display_name: '前期',
              term_sort_key: 10,
              offering_id: 'offering-2',
              course_title: '統計学',
              instructor: '佐藤 花',
              status: 'dropped',
              created_at: '2026-02-17T00:00:00.000Z',
              day_of_week: 2,
              period: 2,
              start_time: '10:45:00',
              room: null,
              is_unslotted: false,
            },
          ]
          : [],
        error: null,
      }),
    );
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

    expect(screen.queryAllByText('統計学').length).toBe(0);

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
      expect(screen.getAllByText(/履修中|履修中（取消済み）/).length).toBeGreaterThan(0);
      expect(toast.success).toHaveBeenCalledWith('時間割に再登録しました');
    });
  });
});
