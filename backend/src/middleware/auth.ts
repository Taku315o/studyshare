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

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: '認証トークンが必要です' });
      return;
    }

    const token = authHeader.split(' ')[1];

    // Supabaseでユーザー確認（署名検証はSupabaseが内部でやってくれる）
    const { data, error } = await supabaseAuth.auth.getUser(token);

    if (error || !data.user) {
      res.status(401).json({ error: '無効なトークンです' });
      return;
    }

    const user = data.user;

    // 必要ならユーザーの追加情報をDBから取得（RLS有効）
    const s = supabaseFromToken(token);
    const { data: userData, error: userErr } = await s
      .from('users')
      .select('email, role')
      .eq('id', user.id)
      .single();

    if (userErr) {
      console.error('ユーザー情報取得エラー:', userErr);
      res.status(500).json({ error: 'ユーザー情報取得に失敗しました' });
      return;
    }

    if (!userData) {
      res.status(404).json({ error: 'ユーザーが見つかりません' });
      return;
    }

    // リクエストにユーザー情報をセット
    req.user = {
      id: user.id,
      email: userData.email,
      role: userData.role
    };

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
