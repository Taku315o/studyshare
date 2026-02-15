import { NextRequest, NextResponse } from 'next/server';
import { GET } from './route';
import { createSupabaseClient } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({
  createSupabaseClient: jest.fn(),
}));

const mockExchangeCodeForSession = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (createSupabaseClient as jest.Mock).mockReturnValue({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
    },
  });
  mockExchangeCodeForSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } }, error: null });
});

function createMockRequest(url: string): NextRequest {
  return {
    url,
    nextUrl: {
      clone: () => {
        const cloned = new URL(url);
        return {
          get pathname() {
            return cloned.pathname;
          },
          set pathname(value: string) {
            cloned.pathname = value;
          },
          searchParams: cloned.searchParams,
          toString: () => cloned.toString(),
        };
      },
    },
  } as unknown as NextRequest;
}

describe('GET /auth/callback', () => {
  it('redirects to /home on successful code exchange', async () => {
    const code = 'test-code';
    const request = createMockRequest(`https://example.com/auth/callback?code=${code}`);

    const response = await GET(request);

    expect(createSupabaseClient).toHaveBeenCalled();
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith(code);
    expect(response instanceof NextResponse).toBe(true);
    expect(response.headers.get('location')).toBe('https://example.com/home');
  });

  it('redirects to / when no code is present', async () => {
    const request = createMockRequest('https://example.com/auth/callback');

    const response = await GET(request);

    expect(createSupabaseClient).not.toHaveBeenCalled();
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toBe('https://example.com/');
  });

  it('redirects to / with auth_error when session exchange returns error', async () => {
    mockExchangeCodeForSession.mockResolvedValueOnce({ data: { session: null }, error: new Error('auth failed') });
    const request = createMockRequest('https://example.com/auth/callback?code=test-code');

    const response = await GET(request);

    expect(response.headers.get('location')).toContain('/?error=auth_error');
  });

  it('redirects to / with callback_error when unexpected error happens', async () => {
    mockExchangeCodeForSession.mockRejectedValueOnce(new Error('unexpected'));
    const request = createMockRequest('https://example.com/auth/callback?code=test-code');

    const response = await GET(request);

    expect(response.headers.get('location')).toContain('/?error=callback_error');
  });
});
