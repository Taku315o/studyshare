import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import { createSupabaseClient } from '@/lib/supabase/client';
import { upsertEnrollment } from '@/lib/timetable/enrollment';
import OfferingHeader from './OfferingHeader';

jest.mock('@/lib/supabase/client', () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock('@/lib/timetable/enrollment', () => ({
  upsertEnrollment: jest.fn(),
}));

const mockRefresh = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ refresh: mockRefresh })),
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('OfferingHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (createSupabaseClient as jest.Mock).mockReturnValue({});
  });

  it('reactivates dropped enrollments', async () => {
    (upsertEnrollment as jest.Mock).mockResolvedValue({
      success: true,
      row: {
        offering_id: 'offering-1',
        previous_status: 'dropped',
        status: 'enrolled',
        visibility: 'match_only',
        was_inserted: false,
      },
      alreadyActive: false,
      wasReactivated: true,
    });

    render(
      <OfferingHeader
        offeringId="offering-1"
        offering={{
          id: 'offering-1',
          courseTitle: 'マーケティング',
          courseCode: null,
          instructorName: '大崎恒次',
          termLabel: '2026 前期',
          timeslotLabel: '月曜 1限',
        }}
        canEnroll
        initialEnrollmentStatus="dropped"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '時間割へ再登録' }));

    await waitFor(() => {
      expect(upsertEnrollment).toHaveBeenCalled();
      expect(mockRefresh).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('時間割に再登録しました');
    });
  });

  it('shows already-added state for active enrollments', () => {
    render(
      <OfferingHeader
        offeringId="offering-1"
        offering={{
          id: 'offering-1',
          courseTitle: 'マーケティング',
          courseCode: null,
          instructorName: '大崎恒次',
          termLabel: '2026 前期',
          timeslotLabel: '月曜 1限',
        }}
        canEnroll
        initialEnrollmentStatus="enrolled"
      />,
    );

    expect(screen.getByRole('button', { name: '追加済み' })).toBeDisabled();
  });
});
