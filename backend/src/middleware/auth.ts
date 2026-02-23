import { Request, Response, NextFunction } from 'express';
import { supabaseAuth, supabaseFromToken } from '../lib/supabase';

// リクエストにユーザー情報を追加するための型拡張
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        role?: string;
      };
    }
  }
}


/**
 * Express middleware that validates a Supabase JWT and enriches the request with the authenticated user's profile.
 *
 * @param req - Incoming request expected to provide a bearer token in the Authorization header.
 * @param res - Response used to return appropriate HTTP errors when authentication fails.
 * @param next - Callback invoked to continue the middleware chain after successful authentication.
 * @returns A promise that resolves once authentication completes and `next` is called or an error response is sent.
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    console.log('[Auth] Authorization header:', authHeader ? 'Bearer ***' : 'なし');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[Auth] トークンなし - 401返却');
      res.status(401).json({ error: '認証トークンが必要です' });
      return;
    }

    const token = authHeader.split(' ')[1];
    console.log('[Auth] Token received, length:', token.length);

    // Supabaseでユーザー確認（署名検証はSupabaseが内部でやってくれる）ここでsupabaseAuthはjwtを検証している。
    const { data, error } = await supabaseAuth.auth.getUser(token);
    console.log('[Auth] getUser result:', { hasUser: !!data?.user, error: error?.message });

    if (error || !data.user) {
      console.log('[Auth] トークン検証失敗:', error?.message);
      res.status(401).json({ error: '無効なトークンです' });
      return;
    }

    const user = data.user;
    const metadataRole = user.app_metadata?.role;
    const fallbackRole =
      metadataRole === 'admin' || metadataRole === 'moderator'
        ? metadataRole
        : 'student';

    // まずは auth.users 由来の情報だけで通す（新スキーマでは legacy users テーブルが存在しない）
    req.user = {
      id: user.id,
      email: user.email ?? undefined,
      role: fallbackRole,
    };

    // legacy互換: users テーブルが存在する環境では role/email を上書き
    try {
      const s = supabaseFromToken(token);
      const { data: userData, error: userErr } = await s
        .from('users')
        .select('email, role')
        .eq('id', user.id)
        .single();

      if (userErr) {
        console.warn('[Auth] legacy usersテーブル参照をスキップ:', userErr.message);
      } else if (userData) {
        req.user = {
          id: user.id,
          email: userData.email ?? req.user.email,
          role: userData.role ?? req.user.role,
        };
      }
    } catch (legacyLookupError) {
      console.warn('[Auth] legacy usersテーブル参照で例外。authユーザー情報で継続します:', legacyLookupError);
    }

    next();
  } catch (error) {
    console.error('認証エラー:', error);
    res.status(500).json({ error: '認証処理でエラーが発生しました' });
  }
};

/**
 * Express middleware ensuring the authenticated user has administrator privileges before continuing.
 *
 * @param req - Request object containing the authenticated user injected by the `authenticate` middleware.
 * @param res - Response used to send 401/403 errors when access is denied.
 * @param next - Callback executed if the requester is an administrator.
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    res.status(401).json({ error: '認証が必要です' });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({ error: '管理者権限が必要です' });
    return;
  }

  next();
};
