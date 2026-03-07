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

export type UpsertEnrollmentResult =
  | { success: true; row: UpsertEnrollmentRow; alreadyActive: boolean; wasReactivated: boolean }
  | { success: false; requiresAuth: true; error: string }
  | { success: false; requiresAuth?: false; error: string };

export async function upsertEnrollment(
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
      throw error;
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
    const message = error instanceof Error ? error.message : '時間割への追加に失敗しました';
    return {
      success: false,
      error: message,
    };
  }
}
