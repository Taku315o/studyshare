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
  useSearchParams: jest.fn(() => new URLSearchParams('day=mon&period=1&termId=term-current&q=マーケ&returnTo=%2Ftimetable')),
}));

const loadEffectiveTimetableConfigMock = loadEffectiveTimetableConfig as jest.Mock;
const originalConsoleError = console.error;

describe('TimetableAddRoute', () => {
  const mockGetUser = jest.fn();
  const mockProfilesMaybeSingle = jest.fn();
  const mockTermsEq = jest.fn();
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
        { id: 'term-current', year: 2026, season: 'first_half', start_date: null, end_date: null },
        { id: 'term-old', year: 2025, season: 'second_half', start_date: null, end_date: null },
      ],
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

        throw new Error(`Unexpected table: ${table}`);
      }),
    });
  });

  afterAll(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it('renders contextual header, query prefill, and slot-matched results', async () => {
    render(<TimetableAddRoute />);

    expect(await screen.findByRole('heading', { name: '月曜 1限 の授業を追加' })).toBeInTheDocument();
    expect(await screen.findByText('大学: 専修大学 / 学期: 2026 前期')).toBeInTheDocument();
    expect(await screen.findByText('マーケティング')).toBeInTheDocument();

    expect(screen.getByDisplayValue('マーケ')).toBeInTheDocument();
    expect(screen.getByText('このコマに一致')).toBeInTheDocument();
    expect(screen.getByText('月曜 1限 に一致する授業を優先表示しています。')).toBeInTheDocument();
  });

  it('updates the route when the selected term changes', async () => {
    render(<TimetableAddRoute />);

    expect(await screen.findByDisplayValue('2026 前期')).toBeInTheDocument();
    expect(await screen.findByText('マーケティング')).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('2026 前期'), {
      target: { value: 'term-old' },
    });

    expect(mockReplace).toHaveBeenCalledWith(
      '/timetable/add?termId=term-old&day=mon&period=1&q=%E3%83%9E%E3%83%BC%E3%82%B1&returnTo=%2Ftimetable',
    );
  });
});
