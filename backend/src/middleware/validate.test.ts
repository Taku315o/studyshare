import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import validate from './validate';

const createMockResponse = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response & {
    status: jest.Mock;
    json: jest.Mock;
  };
};

describe('validate middleware', () => {
  const schema = z.object({
    body: z.object({
      title: z.string().min(1),
    }),
  });

  it('calls next when request matches schema', () => {
    const middleware = validate(schema);
    const req = {
      body: { title: 'valid title' },
      query: {},
      params: {},
    } as unknown as Request;
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 400 and validation errors when request is invalid', () => {
    const middleware = validate(schema);
    const req = {
      body: { title: '' },
      query: {},
      params: {},
    } as unknown as Request;
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: expect.any(Array),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });
});
