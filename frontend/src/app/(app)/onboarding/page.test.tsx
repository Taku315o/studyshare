import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OnboardingPage from './page';
import { createSupabaseClient } from '@/lib/supabase/client';
import {
  DEFAULT_GLOBAL_TIMETABLE_CONFIG,
  loadEffectiveTimetableConfig,
  loadUniversityDefaultPreset,
  upsertUserTimetableSettings,
} from '@/lib/timetable/config';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';

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
      { period: 4, label: '4限', startTime: '14:55', endTime: '16:35' },
      { period: 5, label: '5限', startTime: '16:40', endTime: '18:20' },
      { period: 6, label: '6限', startTime: '18:25', endTime: '20:05' },
      { period: 7, label: '7限', startTime: '20:10', endTime: '21:50' },
    ],
  },
  timetableConfigSchema: {
    safeParse: jest.fn((value: unknown) => ({ success: true, data: value })),
  },
  loadEffectiveTimetableConfig: jest.fn(),
  loadUniversityDefaultPreset: jest.fn(),
  upsertUserTimetableSettings: jest.fn(),
  formatWeekdayLabel: jest.fn((day: number) => ['?', '月', '火', '水', '木', '金', '土', '日'][day] ?? '?'),
  formatWeekdayList: jest.fn(() => '月・火・水・木・金'),
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const loadEffectiveTimetableConfigMock = loadEffectiveTimetableConfig as jest.Mock;
const loadUniversityDefaultPresetMock = loadUniversityDefaultPreset as jest.Mock;
const upsertUserTimetableSettingsMock = upsertUserTimetableSettings as jest.Mock;

describe('OnboardingPage', () => {
  const mockReplace = jest.fn();
  const mockRefresh = jest.fn();
  const getUserMock = jest.fn();
  const fromMock = jest.fn();
  const upsertMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    loadEffectiveTimetableConfigMock.mockResolvedValue({
      config: DEFAULT_GLOBAL_TIMETABLE_CONFIG,
      presetId: 'preset-global',
      source: 'global',
    });
    loadUniversityDefaultPresetMock.mockResolvedValue({
      config: DEFAULT_GLOBAL_TIMETABLE_CONFIG,
      presetId: 'preset-uni-1',
      source: 'university',
    });
    upsertUserTimetableSettingsMock.mockResolvedValue(DEFAULT_GLOBAL_TIMETABLE_CONFIG);

    (useRouter as jest.Mock).mockReturnValue({
      replace: mockReplace,
      refresh: mockRefresh,
    });
    (useSearchParams as jest.Mock).mockReturnValue(
      new URLSearchParams('next=%2Fofferings%2Foffering-1%3Ftab%3Dnotes'),
    );

    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'user@example.com',
          user_metadata: { name: 'テストユーザー' },
        },
      },
      error: null,
    });

    upsertMock.mockResolvedValue({ error: null });

    fromMock.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn().mockResolvedValue({
                data: {
                  display_name: 'テストユーザー',
                  university_id: null,
                  grade_year: null,
                  faculty: null,
                },
                error: null,
              }),
            })),
          })),
          upsert: upsertMock,
        };
      }

      if (table === 'universities') {
        return {
          select: jest.fn(() => ({
            order: jest.fn().mockResolvedValue({
              data: [
                { id: 'uni-1', name: '専修大学' },
                { id: 'uni-2', name: '明治大学' },
              ],
              error: null,
            }),
          })),
        };
      }

      return {};
    });

    (createSupabaseClient as jest.Mock).mockReturnValue({
      auth: {
        getUser: getUserMock,
      },
      from: fromMock,
    });
  });

  it('shows timetable preview, opens edit modal, and saves profile + timetable settings', async () => {
    const user = userEvent.setup();

    render(<OnboardingPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '初期設定' })).toBeInTheDocument();
    });

    expect(screen.getByText('この大学の標準時間割を適用します')).toBeInTheDocument();
    expect(screen.getByText('7限')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '編集する' }));
    expect(screen.getByRole('heading', { name: '時間割の時間・曜日を編集' })).toBeInTheDocument();
    expect(screen.getByLabelText('7限の表示名')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));

    await user.selectOptions(screen.getByLabelText('所属大学'), 'uni-1');
    await waitFor(() => {
      expect(loadUniversityDefaultPresetMock).toHaveBeenCalled();
    });

    await user.selectOptions(screen.getByLabelText('学年'), '2');
    await user.type(screen.getByLabelText('学部（任意）'), '経済学部');
    await user.click(screen.getByRole('button', { name: 'このまま進む' }));

    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalledWith(
        {
          user_id: 'user-1',
          display_name: 'テストユーザー',
          university_id: 'uni-1',
          grade_year: 2,
          faculty: '経済学部',
        },
        { onConflict: 'user_id' },
      );
    });

    expect(upsertUserTimetableSettingsMock).toHaveBeenCalledWith(
      expect.any(Object),
      {
        userId: 'user-1',
        presetId: 'preset-uni-1',
        config: DEFAULT_GLOBAL_TIMETABLE_CONFIG,
      },
    );
    expect(toast.success).toHaveBeenCalledWith('初期設定を保存しました');
    expect(mockReplace).toHaveBeenCalledWith('/offerings/offering-1?tab=notes');
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('saves successfully when faculty is left blank', async () => {
    const user = userEvent.setup();

    render(<OnboardingPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '初期設定' })).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText('所属大学'), 'uni-1');
    await user.selectOptions(screen.getByLabelText('学年'), '2');
    await user.click(screen.getByRole('button', { name: 'このまま進む' }));

    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalledWith(
        {
          user_id: 'user-1',
          display_name: 'テストユーザー',
          university_id: 'uni-1',
          grade_year: 2,
          faculty: null,
        },
        { onConflict: 'user_id' },
      );
    });
  });
});
