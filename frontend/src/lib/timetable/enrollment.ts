import type { SupabaseClient } from '@supabase/supabase-js';
import type { createSupabaseClient } from '@/lib/supabase/client';
import type { Database } from '@/types/supabase';
import type { TimetableStatus } from '@/types/timetable';

type TypedSupabaseClient = ReturnType<typeof createSupabaseClient>;

type UpsertEnrollmentRow = {
  offering_id: string;
  previous_status: TimetableStatus | null;
  status: TimetableStatus;
  visibility: Database['public']['Enums']['enrollment_visibility'];
  was_inserted: boolean;
};

type EnrollmentVisibility = Database['public']['Enums']['enrollment_visibility'];

type EnrollmentFallbackRow = {
  status: TimetableStatus;
  visibility: EnrollmentVisibility;
};

export type UpsertEnrollmentResult =
  | { success: true; row: UpsertEnrollmentRow; alreadyActive: boolean; wasReactivated: boolean }
  | { success: false; requiresAuth: true; error: string }
  | { success: false; requiresAuth?: false; error: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (isObject(error) && typeof error.message === 'string') {
    return error.message;
  }

  return null;
}

function shouldFallbackToDirectUpsert(error: unknown) {
  if (!isObject(error)) {
    return false;
  }

  const code = typeof error.code === 'string' ? error.code : null;
  const message = readErrorMessage(error);
  if (!message) {
    return false;
  }

  return (
    message.includes('upsert_enrollment') &&
    (
      code === 'PGRST202' ||
      message.includes('schema cache') ||
      message.includes('Could not find the function') ||
      message.includes('does not exist')
    )
  );
}

async function fallbackUpsertEnrollment(
  supabase: TypedSupabaseClient,
  args: {
    offeringId: string;
    status: TimetableStatus;
    userId: string;
  },
): Promise<UpsertEnrollmentRow> {
  const { data: existingEnrollmentData, error: existingError } = await supabase
    .from('enrollments')
    .select('status, visibility')
    .eq('user_id', args.userId)
    .eq('offering_id', args.offeringId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  const existingEnrollment = (existingEnrollmentData ?? null) as EnrollmentFallbackRow | null;

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('enrollment_visibility_default')
    .eq('user_id', args.userId)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  const profile = (profileData ?? null) as { enrollment_visibility_default: EnrollmentVisibility } | null;

  const visibility =
    existingEnrollment?.visibility ??
    profile?.enrollment_visibility_default ??
    'match_only';

  const writer = supabase as unknown as SupabaseClient<Database>;

  const { data: rowData, error: upsertError } = await writer
    .from('enrollments')
    .upsert(
      {
        user_id: args.userId,
        offering_id: args.offeringId,
        status: args.status,
        visibility,
      },
      { onConflict: 'user_id,offering_id' },
    )
    .select('offering_id, status, visibility')
    .single();

  if (upsertError) {
    throw upsertError;
  }

  const row = (rowData ?? null) as { offering_id: string; status: TimetableStatus; visibility: EnrollmentVisibility } | null;

  if (!row) {
    throw new Error('時間割への追加に失敗しました');
  }

  return {
    offering_id: row.offering_id,
    previous_status: existingEnrollment?.status ?? null,
    status: row.status,
    visibility: row.visibility,
    was_inserted: existingEnrollment === null,
  };
}

export async function updateEnrollmentStatus(
  supabase: TypedSupabaseClient,
  args: {
    offeringId: string;
    status?: TimetableStatus;
  },
): Promise<UpsertEnrollmentResult> {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    if (!user) {
      return {
        success: false,
        requiresAuth: true,
        error: 'ログインが必要です',
      };
    }

    const rpcClient = supabase as unknown as {
      rpc: (
        fn: 'upsert_enrollment',
        args: {
          _offering_id: string;
          _status: TimetableStatus;
        },
      ) => Promise<{ data: UpsertEnrollmentRow[] | null; error: { message?: string } | null }>;
    };

    const { data, error } = await rpcClient.rpc('upsert_enrollment', {
      _offering_id: args.offeringId,
      _status: args.status ?? 'enrolled',
    });

    if (error) {
      if (!shouldFallbackToDirectUpsert(error)) {
        throw error;
      }

      const row = await fallbackUpsertEnrollment(supabase, {
        offeringId: args.offeringId,
        status: args.status ?? 'enrolled',
        userId: user.id,
      });

      const alreadyActive =
        !row.was_inserted &&
        row.previous_status !== 'dropped' &&
        row.previous_status !== null &&
        row.previous_status === row.status;

      return {
        success: true,
        row,
        alreadyActive,
        wasReactivated: row.previous_status === 'dropped',
      };
    }

    const row = data?.[0];
    if (!row) {
      return {
        success: false,
        error: '時間割への追加に失敗しました',
      };
    }

    const alreadyActive =
      !row.was_inserted &&
      row.previous_status !== 'dropped' &&
      row.previous_status !== null &&
      row.previous_status === row.status;

    return {
      success: true,
      row,
      alreadyActive,
      wasReactivated: row.previous_status === 'dropped',
    };
  } catch (error) {
    const message = readErrorMessage(error) ?? '時間割への追加に失敗しました';
    return {
      success: false,
      error: message,
    };
  }
}

export async function upsertEnrollment(
  supabase: TypedSupabaseClient,
  args: {
    offeringId: string;
    status?: TimetableStatus;
  },
): Promise<UpsertEnrollmentResult> {
  return updateEnrollmentStatus(supabase, {
    offeringId: args.offeringId,
    status: args.status ?? 'enrolled',
  });
}
