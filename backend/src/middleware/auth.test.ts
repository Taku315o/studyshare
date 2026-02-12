import { NextFunction, Request, Response } from 'express';
import { authenticate, requireAdmin } from './auth';
import { supabaseAuth, supabaseFromToken } from '../lib/supabase';

jest.mock('../lib/supabase', () => ({
  supabaseAuth: {
    auth: {
      getUser: jest.fn(),
    },
  },
  supabaseFromToken: jest.fn(),
}));

const createMockResponse = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response & {
    status: jest.Mock;
    json: jest.Mock;
  };
};

describe('authenticate', () => {
  const getUserMock = supabaseAuth.auth.getUser as jest.Mock;
  const supabaseFromTokenMock = supabaseFromToken as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when authorization header is missing', async () => {
    const req = { headers: {} } as Request;
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: '認証トークンが必要です' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is invalid', async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid token' },
    });

    const req = {
      headers: { authorization: 'Bearer invalid-token' },
    } as Request;
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: '無効なトークンです' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 500 when user profile lookup fails', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });

    const singleMock = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'db error' },
    });
    const eqMock = jest.fn().mockReturnValue({ single: singleMock });
    const selectMock = jest.fn().mockReturnValue({ eq: eqMock });
    const fromMock = jest.fn().mockReturnValue({ select: selectMock });

    supabaseFromTokenMock.mockReturnValue({ from: fromMock });

    const req = {
      headers: { authorization: 'Bearer valid-token' },
    } as Request;
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'ユーザー情報取得に失敗しました' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 404 when user profile does not exist', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });

    const singleMock = jest.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const eqMock = jest.fn().mockReturnValue({ single: singleMock });
    const selectMock = jest.fn().mockReturnValue({ eq: eqMock });
    const fromMock = jest.fn().mockReturnValue({ select: selectMock });

    supabaseFromTokenMock.mockReturnValue({ from: fromMock });

    const req = {
      headers: { authorization: 'Bearer valid-token' },
    } as Request;
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'ユーザーが見つかりません' });
    expect(next).not.toHaveBeenCalled();
  });

  it('sets req.user and calls next when token and user profile are valid', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });

    const singleMock = jest.fn().mockResolvedValue({
      data: { email: 'user@example.com', role: 'student' },
      error: null,
    });
    const eqMock = jest.fn().mockReturnValue({ single: singleMock });
    const selectMock = jest.fn().mockReturnValue({ eq: eqMock });
    const fromMock = jest.fn().mockReturnValue({ select: selectMock });

    supabaseFromTokenMock.mockReturnValue({ from: fromMock });

    const req = {
      headers: { authorization: 'Bearer valid-token' },
    } as Request;
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await authenticate(req, res, next);

    expect(req.user).toEqual({
      id: 'user-1',
      email: 'user@example.com',
      role: 'student',
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('requireAdmin', () => {
  it('returns 401 when req.user is missing', () => {
    const req = {} as Request;
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: '認証が必要です' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when user role is not admin', () => {
    const req = { user: { id: 'user-1', role: 'student' } } as Request;
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: '管理者権限が必要です' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when user role is admin', () => {
    const req = { user: { id: 'admin-1', role: 'admin' } } as Request;
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
