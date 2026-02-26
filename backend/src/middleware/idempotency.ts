import { NextFunction, Request, Response } from 'express';

type CompletedEntry = {
  state: 'completed';
  statusCode: number;
  body: unknown;
  expiresAt: number;
};

type InProgressEntry = {
  state: 'in-progress';
  expiresAt: number;
};

type IdempotencyEntry = CompletedEntry | InProgressEntry;

const IDEMPOTENCY_HEADER = 'idempotency-key';
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;
const store = new Map<string, IdempotencyEntry>();

const now = () => Date.now();

const buildStoreKey = (req: Request, key: string): string => {
  const userId = req.user?.id ?? 'anonymous';
  return `${userId}:${req.method}:${req.baseUrl}${req.path}:${key}`;
};

const purgeExpired = () => {
  const current = now();
  for (const [key, entry] of store.entries()) {
    if (entry.expiresAt <= current) {
      store.delete(key);
    }
  }
};

export const idempotencyGuard = (req: Request, res: Response, next: NextFunction): void => {
  const rawKey = req.header(IDEMPOTENCY_HEADER);
  const idempotencyKey = rawKey?.trim();
  if (!idempotencyKey) {
    next();
    return;
  }

  purgeExpired();

  const storeKey = buildStoreKey(req, idempotencyKey);
  const currentEntry = store.get(storeKey);

  if (currentEntry?.state === 'completed') {
    res.setHeader('Idempotency-Replayed', 'true');
    res.status(currentEntry.statusCode).json(currentEntry.body);
    return;
  }

  if (currentEntry?.state === 'in-progress') {
    res.status(409).json({ error: '同一リクエストが処理中です' });
    return;
  }

  const expiresAt = now() + IDEMPOTENCY_TTL_MS;
  store.set(storeKey, { state: 'in-progress', expiresAt });

  let responseBody: unknown;
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  res.json = ((body: unknown) => {
    responseBody = body;
    return originalJson(body);
  }) as Response['json'];

  res.send = ((body: unknown) => {
    if (responseBody === undefined) {
      responseBody = body;
    }
    return originalSend(body);
  }) as Response['send'];

  res.on('finish', () => {
    const statusCode = res.statusCode;
    if (statusCode >= 200 && statusCode < 300) {
      store.set(storeKey, {
        state: 'completed',
        statusCode,
        body: responseBody,
        expiresAt: now() + IDEMPOTENCY_TTL_MS,
      });
      return;
    }

    store.delete(storeKey);
  });

  res.on('close', () => {
    if (!res.writableEnded) {
      store.delete(storeKey);
    }
  });

  next();
};

export const resetIdempotencyStoreForTests = (): void => {
  store.clear();
};
