import cors from 'cors';
import express, { type Request, type Response, type NextFunction } from 'express';
import assignmentRoutes from './routes/assignments';
import { createUploadRoutes } from './routes/uploads';
import { loadBackendEnv } from './lib/env';

type CreateAppOptions = {
  enableLegacyAssignmentsApi?: boolean;
  enableLegacyUploadApi?: boolean;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();
const ONE_MINUTE_MS = 60_000;
const DEFAULT_RATE_LIMIT_MAX = 60;

loadBackendEnv();

const isProduction = process.env.NODE_ENV === 'production';

const parseAllowedOrigins = (): string[] => {
  const configured = process.env.CORS_ALLOWED_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configured && configured.length > 0) {
    return configured;
  }

  if (!isProduction) {
    return ['http://localhost:3000', 'http://127.0.0.1:3000'];
  }

  throw new Error('CORS_ALLOWED_ORIGINS must be set in production');
};

const allowedOrigins = new Set(parseAllowedOrigins());

const applySecurityHeaders = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('X-DNS-Prefetch-Control', 'off');

  if (isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
};

const resolveRateLimitMax = (): number => {
  const rawValue = process.env.API_RATE_LIMIT_MAX?.trim();
  const parsed = rawValue ? Number(rawValue) : NaN;

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return DEFAULT_RATE_LIMIT_MAX;
};

const apiRateLimit = (req: Request, res: Response, next: NextFunction) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(',')[0];
  const clientKey = (forwardedIp || req.ip || 'unknown').trim();
  const now = Date.now();
  const current = rateLimitStore.get(clientKey);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(clientKey, { count: 1, resetAt: now + ONE_MINUTE_MS });
    next();
    return;
  }

  if (current.count >= resolveRateLimitMax()) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    res.setHeader('Retry-After', retryAfterSeconds.toString());
    res.status(429).json({ error: 'リクエスト数が多すぎます。時間をおいて再度お試しください。' });
    return;
  }

  current.count += 1;
  rateLimitStore.set(clientKey, current);
  next();
};

//ファクトリ関数を作成して、オプションを受け取れるようにする。これにより、テスト時にレガシーAPIを無効化できる。
export const createApp = (options: CreateAppOptions = {}) => {
  const app = express();
  const enableLegacyAssignmentsApi =
    options.enableLegacyAssignmentsApi ??
    process.env.ENABLE_LEGACY_ASSIGNMENTS_API === 'true';

  app.disable('x-powered-by');
  app.use(applySecurityHeaders);
  app.use(cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }));
  app.use(express.json());
  app.use('/api', apiRateLimit);

  app.get('/', (_req, res) => {
    res.send('Hello from Express + TypeScript!');
  });

  app.use('/api', createUploadRoutes({ enableLegacyUploadApi: options.enableLegacyUploadApi }));

  if (enableLegacyAssignmentsApi) {
    app.use('/api', assignmentRoutes);
  }

  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (error instanceof Error && error.message === 'Not allowed by CORS') {
      res.status(403).json({ error: '許可されていない origin です' });
      return;
    }

    next(error);
  });

  return app;
};

const app = createApp();

export default app;
