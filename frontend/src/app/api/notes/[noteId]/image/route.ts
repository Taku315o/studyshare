import { NextRequest, NextResponse } from 'next/server';
import { getServerBackendApiUrl } from '@/lib/backendApi';
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> },
) {
  const response = NextResponse.next();
  const supabase = createRouteHandlerSupabaseClient(request, response);
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  const { noteId } = await params;
  const upstream = await fetch(`${getServerBackendApiUrl()}/notes/${noteId}/image-url`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    cache: 'no-store',
  });

  if (!upstream.ok) {
    return NextResponse.json({ error: '画像が見つかりません' }, { status: upstream.status });
  }

  const payload = (await upstream.json()) as { url?: string };
  if (!payload.url) {
    return NextResponse.json({ error: '画像URLの取得に失敗しました' }, { status: 502 });
  }

  return NextResponse.redirect(payload.url, { status: 307 });
}
