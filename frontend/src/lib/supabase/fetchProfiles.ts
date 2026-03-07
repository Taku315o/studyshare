import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export type BasicProfileMapValue = Pick<ProfileRow, 'user_id' | 'display_name' | 'avatar_url'>;
export type DmProfileMapValue = Pick<ProfileRow, 'user_id' | 'display_name' | 'avatar_url' | 'allow_dm'>;

type FetchProfilesOptions = {
  includeAllowDm?: boolean;
};

export async function fetchProfiles(
  supabase: SupabaseClient<Database>,
  userIds: string[],
): Promise<Map<string, BasicProfileMapValue>>;
export async function fetchProfiles(
  supabase: SupabaseClient<Database>,
  userIds: string[],
  options: { includeAllowDm: true },
): Promise<Map<string, DmProfileMapValue>>;
export async function fetchProfiles(
  supabase: SupabaseClient<Database>,
  userIds: string[],
  options?: FetchProfilesOptions,
) {
  if (userIds.length === 0) {
    return new Map<string, BasicProfileMapValue | DmProfileMapValue>();
  }

  const includeAllowDm = options?.includeAllowDm === true;
  const columns = includeAllowDm
    ? 'user_id, display_name, avatar_url, allow_dm'
    : 'user_id, display_name, avatar_url';
  const { data } = await supabase.from('profiles').select(columns).in('user_id', userIds);

  const rows = (data ?? []) as Array<BasicProfileMapValue | DmProfileMapValue>;
  const map = new Map<string, BasicProfileMapValue | DmProfileMapValue>();
  rows.forEach((row) => {
    map.set(row.user_id, row);
  });
  return map;
}
