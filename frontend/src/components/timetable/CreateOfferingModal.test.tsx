import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import { createSupabaseClient } from '@/lib/supabase/client';
import CreateOfferingModal from './CreateOfferingModal';

jest.mock('@/lib/supabase/client', () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock('@/lib/timetable/config', () => ({
  formatWeekdayLabel: jest.fn((day: number) => ['?', '月', '火', '水', '木', '金', '土', '日'][day] ?? '?'),
}));

jest.mock('@/lib/timetable/enrollment', () => ({
  upsertEnrollment: jest.fn(),
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('CreateOfferingModal', () => {
  const mockRpc = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (createSupabaseClient as jest.Mock).mockReturnValue({
      rpc: mockRpc,
    });
  });

  it('shows validation errors when required fields are missing', async () => {
    render(
      <CreateOfferingModal
        isOpen
        universityName="専修大学"
        periodOptions={[
          { period: 1, label: '1限' },
          { period: 2, label: '2限' },
        ]}
        termOptions={[
          {
            id: 'term-1',
            academicYear: 2026,
            code: 'first_half',
            displayName: '前期',
            sortKey: 10,
            startDate: null,
            endDate: null,
          },
        ]}
        initialTermId="term-1"
        initialDayOfWeek={1}
        initialPeriod={1}
        catalogCoverage={null}
        onClose={jest.fn()}
        onComplete={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '作成して登録' }));

    expect(toast.error).toHaveBeenCalledWith('講義名を入力してください。');
  });

  it('blocks creation while exact/strong candidates exist until override is checked', async () => {
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
          enrollment_count: 3,
          my_status: null,
          created_at: '2026-03-01T00:00:00.000Z',
          candidate_kind: 'exact',
          reasons: ['同名', '同一曜日・限'],
        },
      ],
      error: null,
    });

    render(
      <CreateOfferingModal
        isOpen
        universityName="専修大学"
        periodOptions={[
          { period: 1, label: '1限' },
          { period: 2, label: '2限' },
        ]}
        termOptions={[
          {
            id: 'term-1',
            academicYear: 2026,
            code: 'first_half',
            displayName: '前期',
            sortKey: 10,
            startDate: null,
            endDate: null,
          },
        ]}
        initialTermId="term-1"
        initialDayOfWeek={1}
        initialPeriod={1}
        catalogCoverage={null}
        onClose={jest.fn()}
        onComplete={jest.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('マーケティング'), {
      target: { value: 'マーケティング' },
    });
    fireEvent.change(screen.getByPlaceholderText('大崎恒次'), {
      target: { value: '大崎恒次' },
    });
    fireEvent.change(screen.getByPlaceholderText('302'), {
      target: { value: '302' },
    });

    await waitFor(() => {
      expect(screen.getByText('マーケティング')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: '作成して登録' })).toBeDisabled();

    fireEvent.click(screen.getByLabelText('候補とは別授業として作成する'));

    expect(screen.getByRole('button', { name: '作成して登録' })).toBeEnabled();
  });

  it('shows a partial coverage warning when the term is only partially imported', () => {
    render(
      <CreateOfferingModal
        isOpen
        universityName="専修大学"
        periodOptions={[{ period: 1, label: '1限' }]}
        termOptions={[
          {
            id: 'term-1',
            academicYear: 2026,
            code: 'first_half',
            displayName: '前期',
            sortKey: 10,
            startDate: null,
            endDate: null,
          },
        ]}
        initialTermId="term-1"
        initialDayOfWeek={1}
        initialPeriod={1}
        catalogCoverage={{
          coverageKind: 'partial',
          sourceScopeLabels: ['経済学部', '経営学部'],
        }}
        onClose={jest.fn()}
        onComplete={jest.fn()}
      />,
    );

    expect(screen.getByText('この学期は一部区分のみ収録中です。')).toBeInTheDocument();
    expect(screen.getByText('現在の収録区分: 経済学部、経営学部')).toBeInTheDocument();
  });
});
