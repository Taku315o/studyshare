import { updateEnrollmentStatus, upsertEnrollment } from './enrollment';

describe('upsertEnrollment', () => {
  const mockGetUser = jest.fn();
  const mockRpc = jest.fn();
  const mockFrom = jest.fn();

  const supabase = {
    auth: {
      getUser: mockGetUser,
    },
    rpc: mockRpc,
    from: mockFrom,
  } as Parameters<typeof upsertEnrollment>[0];

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  });

  it('falls back to direct enrollment upsert when the RPC is missing from the schema cache', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: {
        code: 'PGRST202',
        message: 'Could not find the function public.upsert_enrollment(_offering_id, _status) in the schema cache',
      },
    });

    const enrollmentMaybeSingle = jest.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const profileMaybeSingle = jest.fn().mockResolvedValue({
      data: { enrollment_visibility_default: 'public' },
      error: null,
    });
    const upsertSingle = jest.fn().mockResolvedValue({
      data: {
        offering_id: 'offering-1',
        status: 'enrolled',
        visibility: 'public',
      },
      error: null,
    });

    const enrollmentsTable = {
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: enrollmentMaybeSingle,
          })),
        })),
      })),
      upsert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: upsertSingle,
        })),
      })),
    };

    const profilesTable = {
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: profileMaybeSingle,
        })),
      })),
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'enrollments') {
        return enrollmentsTable;
      }

      if (table === 'profiles') {
        return profilesTable;
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await upsertEnrollment(supabase, {
      offeringId: 'offering-1',
      status: 'enrolled',
    });

    expect(result).toEqual({
      success: true,
      row: {
        offering_id: 'offering-1',
        previous_status: null,
        status: 'enrolled',
        visibility: 'public',
        was_inserted: true,
      },
      alreadyActive: false,
      wasReactivated: false,
    });

    expect(enrollmentsTable.upsert).toHaveBeenCalledWith(
      {
        user_id: 'user-1',
        offering_id: 'offering-1',
        status: 'enrolled',
        visibility: 'public',
      },
      { onConflict: 'user_id,offering_id' },
    );
  });

  it('returns the original error when the RPC fails for a real application reason', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: {
        code: 'P0001',
        message: 'offering_not_found',
      },
    });

    const result = await upsertEnrollment(supabase, {
      offeringId: 'missing-offering',
      status: 'enrolled',
    });

    expect(result).toEqual({
      success: false,
      error: 'offering_not_found',
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('updates dropped status through the shared mutation helper', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          offering_id: 'offering-1',
          previous_status: 'enrolled',
          status: 'dropped',
          visibility: 'match_only',
          was_inserted: false,
        },
      ],
      error: null,
    });

    const result = await updateEnrollmentStatus(supabase, {
      offeringId: 'offering-1',
      status: 'dropped',
    });

    expect(result).toEqual({
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
  });
});
