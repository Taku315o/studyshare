import { fireEvent, render, screen } from '@testing-library/react';
import { createSupabaseClient } from '@/lib/supabase/client';
import { loadEffectiveTimetableConfig } from '@/lib/timetable/config';
import TimetableAddRoute from './page';

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

jest.mock('@/components/timetable/CreateOfferingModal', () => ({
  __esModule: true,
  default: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="create-offering-modal" /> : null),
}));

const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ replace: mockReplace })),
}));

const loadEffectiveTimetableConfigMock = loadEffectiveTimetableConfig as jest.Mock;
const originalConsoleError = console.error;

describe('TimetableAddRoute', () => {
  const mockGetUser = jest.fn();
  const mockProfilesMaybeSingle = jest.fn();
  const mockTermsEq = jest.fn();
  const mockCoverageMaybeSingle = jest.fn();
  const mockRpc = jest.fn();

  beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      const [firstArg] = args;
      if (typeof firstArg === 'string' && firstArg.includes('not wrapped in act')) {
        return;
      }

      originalConsoleError(...args);
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();

    loadEffectiveTimetableConfigMock.mockResolvedValue({
      config: {
        weekdays: [1, 2, 3, 4, 5],
        periods: [
          { period: 1, label: '1限', startTime: '09:00', endTime: '10:40' },
          { period: 2, label: '2限', startTime: '10:45', endTime: '12:25' },
          { period: 3, label: '3限', startTime: '13:10', endTime: '14:50' },
        ],
      },
      presetId: 'preset-1',
      source: 'user',
    });

    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockProfilesMaybeSingle.mockResolvedValue({
      data: {
        university_id: 'uni-1',
        university: { name: '専修大学' },
      },
      error: null,
    });
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
          id: 'term-old',
          academic_year: 2025,
          code: 'second_half',
          display_name: '後期',
          sort_key: 20,
          start_date: '2025-09-01',
          end_date: '2026-01-31',
        },
      ],
      error: null,
    });
    mockCoverageMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });
    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'search_timetable_offerings') {
        return Promise.resolve({
          data: [
            {
              offering_id: 'offering-1',
              course_title: 'マーケティング',
              course_code: null,
              instructor: '大崎恒次',
              room: '302',
              slot_labels: ['月曜 1限'],
              slot_details: [{ dayOfWeek: 1, period: 1, room: '302' }],
              slot_match: true,
              enrollment_count: 2,
              my_status: null,
              created_at: '2026-03-01T00:00:00.000Z',
            },
            {
              offering_id: 'offering-2',
              course_title: '経営学入門',
              course_code: null,
              instructor: '佐藤花',
              room: '201',
              slot_labels: ['火曜 2限'],
              slot_details: [{ dayOfWeek: 2, period: 2, room: '201' }],
              slot_match: false,
              enrollment_count: 4,
              my_status: 'planned',
              created_at: '2026-03-01T00:00:00.000Z',
            },
          ],
          error: null,
        });
      }

      throw new Error(`Unexpected rpc: ${fn}`);
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

        if (table === 'offering_catalog_coverages') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({ maybeSingle: mockCoverageMaybeSingle })),
            })),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    });
  });

  afterAll(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it('renders contextual header and timetable-specific CTAs', async () => {
    const view = await TimetableAddRoute({
      searchParams: Promise.resolve({
        day: 'mon',
        period: '1',
        termId: 'term-current',
        q: 'マーケ',
        returnTo: '/timetable',
      }),
    });

    render(view);

    expect(await screen.findByRole('heading', { name: '月曜 1限 の授業を追加' })).toBeInTheDocument();
    expect(await screen.findByText('大学: 専修大学 / 学期: 2026 前期')).toBeInTheDocument();
    expect(await screen.findByText('マーケティング')).toBeInTheDocument();
    expect(screen.getByText('このコマに一致')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '登録' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: '詳細を見る' }).length).toBeGreaterThan(0);
    expect(screen.getByText('追加済み')).toBeInTheDocument();
  });

  it('updates the route when the selected term changes', async () => {
    const view = await TimetableAddRoute({
      searchParams: Promise.resolve({
        day: 'mon',
        period: '1',
        termId: 'term-current',
        q: 'マーケ',
        returnTo: '/timetable',
      }),
    });

    render(view);

    expect(await screen.findByDisplayValue('2026 前期')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'term-old' },
    });

    expect(mockReplace).toHaveBeenCalledWith(
      '/timetable/add?termId=term-old&q=%E3%83%9E%E3%83%BC%E3%82%B1&day=mon&period=1&returnTo=%2Ftimetable',
    );
  });

  it('shows a partial import banner for timetable add mode', async () => {
    mockCoverageMaybeSingle.mockResolvedValue({
      data: {
        coverage_kind: 'partial',
        source_scope_labels: ['経済学部', '経営学部'],
      },
      error: null,
    });

    const view = await TimetableAddRoute({
      searchParams: Promise.resolve({
        day: 'mon',
        period: '1',
        termId: 'term-current',
        q: 'マーケ',
        returnTo: '/timetable',
      }),
    });

    render(view);

    expect(
      await screen.findByText('この学期の授業データは一部区分のみ収録中です。見つからない授業は未収録の可能性があります。'),
    ).toBeInTheDocument();
    expect(screen.getByText('収録中の区分: 経済学部、経営学部')).toBeInTheDocument();
  });
});
