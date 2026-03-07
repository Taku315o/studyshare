import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import toast from 'react-hot-toast';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  DEFAULT_GLOBAL_TIMETABLE_CONFIG,
  loadEffectiveTimetableConfig,
  upsertUserTimetableSettings,
} from '@/lib/timetable/config';
import supabase from '@/lib/supabase';
import SettingsPanel from './SettingsPanel';

const signOutMock = jest.fn();

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    signOut: signOutMock,
  }),
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
  useSearchParams: jest.fn(),
}));

jest.mock('@/lib/timetable/config', () => ({
  DEFAULT_GLOBAL_TIMETABLE_CONFIG: {
    weekdays: [1, 2, 3, 4, 5],
    periods: [
      { period: 1, label: '1限', startTime: '09:00', endTime: '10:40' },
      { period: 2, label: '2限', startTime: '10:45', endTime: '12:25' },
    ],
  },
  timetableConfigSchema: {
    safeParse: jest.fn((value: unknown) => ({ success: true, data: value })),
  },
  loadEffectiveTimetableConfig: jest.fn(),
  upsertUserTimetableSettings: jest.fn(),
  formatWeekdayLabel: jest.fn((day: number) => ['?', '月', '火', '水', '木', '金', '土', '日'][day] ?? '?'),
  formatWeekdayList: jest.fn(() => '月・火・水・木・金'),
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock('@/lib/supabase', () => ({
  __esModule: true,
  default: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

const loadEffectiveTimetableConfigMock = loadEffectiveTimetableConfig as jest.Mock;
const upsertUserTimetableSettingsMock = upsertUserTimetableSettings as jest.Mock;

const supabaseMock = supabase as unknown as {
  auth: {
    getUser: jest.Mock;
  };
  from: jest.Mock;
  rpc: jest.Mock;
};

describe('SettingsPanel', () => {
  const maybeSingleMock = jest.fn();
  const eqMock = jest.fn();
  const selectMock = jest.fn();
  const replaceMock = jest.fn();
  let queryString = '';

  beforeEach(() => {
    jest.clearAllMocks();

    queryString = '';
    (useRouter as jest.Mock).mockReturnValue({ replace: replaceMock });
    (usePathname as jest.Mock).mockReturnValue('/me');
    (useSearchParams as jest.Mock).mockImplementation(() => new URLSearchParams(queryString));

    maybeSingleMock.mockResolvedValue({
      data: { enrollment_visibility_default: 'match_only', university_id: 'uni-1' },
      error: null,
    });
    eqMock.mockReturnValue({ maybeSingle: maybeSingleMock });
    selectMock.mockReturnValue({ eq: eqMock });

    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    supabaseMock.from.mockReturnValue({
      select: selectMock,
    });
    supabaseMock.rpc.mockResolvedValue({ error: null });

    loadEffectiveTimetableConfigMock.mockResolvedValue({
      config: DEFAULT_GLOBAL_TIMETABLE_CONFIG,
      presetId: 'preset-1',
      source: 'user',
    });
    upsertUserTimetableSettingsMock.mockResolvedValue(DEFAULT_GLOBAL_TIMETABLE_CONFIG);
  });

  it('opens visibility modal and saves selected visibility', async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);

    await waitFor(() => {
      expect(screen.getByText('マッチング用途のみ')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: '公開範囲を設定' }));
    await user.selectOptions(screen.getByLabelText('公開範囲'), 'public');
    await user.click(screen.getByRole('button', { name: '公開範囲を保存' }));

    await waitFor(() => {
      expect(supabaseMock.rpc).toHaveBeenCalledWith('update_visibility_settings', {
        new_visibility: 'public',
      });
    });
    expect(toast.success).toHaveBeenCalledWith('公開範囲を保存し、履修データへ反映しました');
    expect(screen.queryByRole('heading', { name: '公開範囲設定' })).not.toBeInTheDocument();
  });

  it('closes visibility modal when overlay is clicked', async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '公開範囲を設定' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: '公開範囲を設定' }));
    expect(screen.getByRole('heading', { name: '公開範囲設定' })).toBeInTheDocument();

    await user.click(screen.getByTestId('settings-visibility-modal-overlay'));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: '公開範囲設定' })).not.toBeInTheDocument();
    });
  });

  it('opens timetable modal from query and saves timetable settings', async () => {
    const user = userEvent.setup();
    queryString = 'modal=timetable-settings&from=timetable';

    render(<SettingsPanel />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '時間割の時間・曜日を編集' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: '時間割設定を保存' }));

    await waitFor(() => {
      expect(upsertUserTimetableSettingsMock).toHaveBeenCalledWith(
        expect.any(Object),
        {
          userId: 'user-1',
          presetId: 'preset-1',
          config: DEFAULT_GLOBAL_TIMETABLE_CONFIG,
        },
      );
    });

    expect(toast.success).toHaveBeenCalledWith('時間割の時間・曜日を保存しました');
    expect(replaceMock).toHaveBeenCalledWith('/me');
  });
});
