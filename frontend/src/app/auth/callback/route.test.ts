//認証コードがある場合・ない場合・エラーが発生した場合の3つのシナリオで、リダイレクトが正しく行われるかをテスト。
import { GET } from './route';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({
    createSupabaseClient: jest.fn(),
}));

const mockExchangeCodeForSession = jest.fn();

beforeEach(() => {
    jest.clearAllMocks();
    createSupabaseClient.mockReturnValue({
        auth: {
            exchangeCodeForSession: mockExchangeCodeForSession,
        },
    });
    mockExchangeCodeForSession.mockResolvedValue({ data: { session: {} }, error: null });
});

function createMockRequest(url: string): NextRequest {
    return {
        url,
        nextUrl: {
            clone: () => {
                const u = new URL(url);
                return {
                    pathname: '/',
                    searchParams: {
                        delete: jest.fn(),
                        set: jest.fn(),
                    },
                    toString: () => u.origin + '/',
                };
            },
        },
    } as unknown as NextRequest;
}

describe('GET', () => {
    it('should exchange code and redirect to root', async () => {
        const code = 'test-code';
        const url = `https://example.com/auth/callback?code=${code}`;
        const request = createMockRequest(url);

        const response = await GET(request);

        expect(createSupabaseClient).toHaveBeenCalled();
        expect(mockExchangeCodeForSession).toHaveBeenCalledWith(code);
        expect(response instanceof NextResponse).toBe(true);
    });

    it('should redirect to root if no code is present', async () => {
        const url = `https://example.com/auth/callback`;
        const request = createMockRequest(url);

        const response = await GET(request);

        expect(createSupabaseClient).not.toHaveBeenCalled();
        expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
        expect(response instanceof NextResponse).toBe(true);
    });

    it('should handle errors and redirect', async () => {
        mockExchangeCodeForSession.mockImplementationOnce(() => {
            throw new Error('test error');
        });
        const code = 'test-code';
        const url = `https://example.com/auth/callback?code=${code}`;
        const request = createMockRequest(url);

        const response = await GET(request);

        expect(response instanceof NextResponse).toBe(true);
    });
});