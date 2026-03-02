import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import toast from 'react-hot-toast';
import supabase from '@/lib/supabase';
import SettingsPanel from './SettingsPanel';

const signOutMock = jest.fn();

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    signOut: signOutMock,
  }),
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

  beforeEach(() => {
    jest.clearAllMocks();

    maybeSingleMock.mockResolvedValue({
      data: { enrollment_visibility_default: 'match_only' },
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

  it('closes modal when overlay is clicked', async () => {
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
});
