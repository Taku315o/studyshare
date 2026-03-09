import { render, screen, waitFor } from '@testing-library/react';
import { createSupabaseClient } from '@/lib/supabase/client';
import { loadEffectiveTimetableConfig } from '@/lib/timetable/config';
import OfferingsPage from './page';

jest.mock('@/lib/supabase/client', () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock('@/lib/timetable/config', () => ({
  DEFAULT_GLOBAL_TIMETABLE_CONFIG: {
    weekdays: [1, 2, 3, 4, 5],
    periods: [
      { period: 1, label: '1限', startTime: '09:00', endTime: '10:40' },
      { period: 2, label: '2限', startTime: '10:45', endTime: '12:25' },
    ],
  },
  loadEffectiveTimetableConfig: jest.fn(),
  formatWeekdayLabel: jest.fn((day: number) => ['?', '月', '火', '水', '木', '金', '土', '日'][day] ?? '?'),
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ replace: jest.fn() })),
}));

const loadEffectiveTimetableConfigMock = loadEffectiveTimetableConfig as jest.Mock;

describe('OfferingsPage', () => {
  const mockReplace = jest.fn();
  const mockGetUser = jest.fn();
  const mockProfilesMaybeSingle = jest.fn();
  const mockTermsEq = jest.fn();
  const mockRpc = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    const { useRouter } = jest.requireMock('next/navigation') as { useRouter: jest.Mock };
    useRouter.mockReturnValue({ replace: mockReplace });

    loadEffectiveTimetableConfigMock.mockResolvedValue({
      config: {
        weekdays: [1, 2, 3, 4, 5],
        periods: [
          { period: 1, label: '1限', startTime: '09:00', endTime: '10:40' },
          { period: 2, label: '2限', startTime: '10:45', endTime: '12:25' },
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
          start_date: null,
          end_date: null,
        },
        {
          id: 'term-old',
          academic_year: 2025,
          code: 'second_half',
          display_name: '後期',
          sort_key: 20,
          start_date: null,
          end_date: null,
        },
      ],
      error: null,
    });
    mockRpc.mockResolvedValue({
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

  it('renders browse mode search UI and detail CTA only', async () => {
    const view = await OfferingsPage({
      searchParams: Promise.resolve({
        termId: 'term-current',
        q: 'マーケ',
      }),
    });

    render(view);

    expect(await screen.findByRole('heading', { name: '授業・口コミ' })).toBeInTheDocument();
    expect(screen.getByText('授業を検索して、詳細ページでノート・口コミ・質問・受講者情報を確認できます。')).toBeInTheDocument();
    expect(await screen.findByText('マーケティング')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '詳細を見る' })).toHaveAttribute('href', '/offerings/offering-1');
    expect(screen.queryByRole('button', { name: '登録' })).not.toBeInTheDocument();
    expect(screen.queryByText('このコマに一致')).not.toBeInTheDocument();
  });

  it('normalizes to the default term when no term is selected', async () => {
    const view = await OfferingsPage({
      searchParams: Promise.resolve({
        q: 'マーケ',
      }),
    });

    render(view);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/offerings?termId=term-current&q=%E3%83%9E%E3%83%BC%E3%82%B1');
    });
  });
});
