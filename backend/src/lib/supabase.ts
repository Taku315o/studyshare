import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.SUPABASE_URL!;
const anon = process.env.SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Supabase client configured with the anon key for operations that should respect RLS policies.
 *
 * @returns A Supabase client intended for authenticated user interactions.
 */
export const supabaseAuth = createClient(url, anon, {
  auth: { autoRefreshToken: false, persistSession: false }
});

/**
 * Supabase client configured with the service role key for privileged server-side operations.
 *
 * @returns A Supabase client that bypasses RLS, intended for secure backend use only.
 */
export const supabaseAdmin = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false }
});

/**
 * Creates a Supabase client scoped to the supplied JWT so that requests run with the caller's permissions.
 *
 * @param token - JWT extracted from the incoming request Authorization header.
 * @returns A Supabase client authenticated with the provided token.
 */
export const supabaseFromToken = (token: string) =>
  createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false }
  });


  //サービスキーで管理者用APIを叩く
  // 例: supabaseAdmin.from('table').select('*')
  //ユーザーのJWTでユーザー権限APIを叩く