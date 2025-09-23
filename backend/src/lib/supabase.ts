import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.SUPABASE_URL!;
const anon = process.env.SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// 認証や基本操作用（anon key）
// フロントや「getUser(token)」で利用する想定
export const supabaseAuth = createClient(url, anon, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// 管理・バッチ専用（RLSを無視する権限）
// Express の管理APIや内部処理でのみ利用する
export const supabaseAdmin = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// リクエストのJWTを使ったユーザー権限クライアント
// DBアクセスをユーザー権限で実行できる（RLSが効く）
export const supabaseFromToken = (token: string) =>
  createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false }
  });


  //サービスキーで管理者用APIを叩く
  // 例: supabaseAdmin.from('table').select('*')
  //ユーザーのJWTでユーザー権限APIを叩く