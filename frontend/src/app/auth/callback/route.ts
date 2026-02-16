//Supabaseを使ったGoogle OAuth認証後、リダイレクトされるコールバック処理を行うAPIルート。
// URLに含まれる認証コードをSupabaseに送り、ユーザーセッション（ログイン状態）を確立します。処理完了後、ユーザーをトップページにリダイレクトさせます。

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server';
//Supabaseが返してきたcodeを使ってセッションを作成
//codeなどのクエリを取り除いたうえでトップページにリダイレクト
/**
 * Handles the Supabase OAuth callback by exchanging the authorization code for a session and redirecting to the home page.
 *
 * @param request - Incoming Next.js request containing the authorization code query parameter.
 * @returns Redirect response to the top page or post-login home path with query parameters sanitized.
 */
export async function GET(request: NextRequest) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = '/';
  redirectUrl.searchParams.delete('code');
  redirectUrl.searchParams.delete('error');
  redirectUrl.searchParams.delete('error_description');
  const response = NextResponse.next();

  const createRedirectWithCookies = (url: URL) => {
    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  };

  try {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    
    if (code) {
      const supabase = createRouteHandlerSupabaseClient(request, response);
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (error) {
        console.error('セッション交換エラー:', error);
        redirectUrl.searchParams.set('error', 'auth_error');
        return createRedirectWithCookies(redirectUrl);
      }

      // セッションが正常に設定されたことを確認
      if (data.session) {
        console.log('セッション正常に設定されました:', data.session.user.id);
        redirectUrl.pathname = '/home';
        return createRedirectWithCookies(redirectUrl);
      }
    }
    
    return createRedirectWithCookies(redirectUrl);
  } catch (error) {
    console.error('認証コールバックエラー:', error);
    redirectUrl.searchParams.set('error', 'callback_error');
    return createRedirectWithCookies(redirectUrl);
  }
}
