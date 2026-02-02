//supabase.ts
import { createClient } from '@supabase/supabase-js';
//フロントエンド側でSupabaseと通信するためのクライアントを初期化するファイルです。
// NEXT_PUBLIC_から始まる公開可能な環境変数を使って、安全にクライアントをセットアップします。

export type Database = {
  public: {
    Views: Record<string, never>;
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          role: 'student' | 'admin';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          role?: 'student' | 'admin';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          role?: 'student' | 'admin';
          created_at?: string;
          updated_at?: string;
        };
      };
      assignments: {
        Row: {
          id: string;
          title: string;
          description: string;
          image_url: string | null;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description: string;
          image_url?: string | null;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string;
          image_url?: string | null;
          user_id?: string;
          created_at?: string;
        };
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
    Functions: {
      search_assignments: {
        Args: { search_query: string };
        Returns: Array<{
          id: string;
          title: string;
          description: string;
          image_url: string | null;
          user_id: string;
          created_at: string;
        }>;
      };
    };
  };
};

/**
 * Instantiates a Supabase client configured for use in the browser with persisted sessions enabled.
 *
 * @returns A Supabase client typed to the application's database schema.
 */
export const createSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  
  // デバッグ情報（本番環境では削除すること）
  console.log('Supabase URL:', supabaseUrl);
  console.log('Supabase Key exists:', !!supabaseAnonKey);

  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true, // セッションをlocalStorageに永続化
      autoRefreshToken: true, // トークンの自動更新
      detectSessionInUrl: true, // URLからセッション情報を検出
    },
  });
  return supabase;
};

// クライアントインスタンス（シングルトン）

/**
 * Shared Supabase client instance for reuse across the client-side application.
 */
const supabase = createSupabaseClient();
export default supabase;