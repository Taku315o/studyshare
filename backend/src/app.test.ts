import request from 'supertest';

jest.mock('./lib/env', () => ({
  loadBackendEnv: jest.fn(),
}));

jest.mock('./routes/uploads', () => ({
  createUploadRoutes: jest.fn(() => {
    const express = require('express');
    return express.Router();
  }),
}));

jest.mock('./routes/assignments', () => {
  const express = require('express');
  return {
    __esModule: true,
    default: express.Router(),
  };
});

import { createApp } from './app';

describe('createApp trust proxy configuration', () => {
  const originalTrustProxy = process.env.TRUST_PROXY;

  afterEach(() => {
    if (originalTrustProxy === undefined) {
      delete process.env.TRUST_PROXY;
    } else {
      process.env.TRUST_PROXY = originalTrustProxy;
    }
  });

  it('defaults to false in non-production when TRUST_PROXY is unset', () => {
    delete process.env.TRUST_PROXY;

    const app = createApp();

    expect(app.get('trust proxy')).toBe(false);
  });

  it('accepts a numeric hop count for a trusted proxy chain', () => {
    process.env.TRUST_PROXY = '1';

    const app = createApp();

    expect(app.get('trust proxy')).toBe(1);
  });

  it('returns 200 on health endpoints', async () => {
    const app = createApp();

    const rootHealth = await request(app).get('/healthz');
    const apiHealth = await request(app).get('/api/health');

    expect(rootHealth.status).toBe(200);
    expect(rootHealth.body).toEqual({ status: 'ok' });
    expect(apiHealth.status).toBe(200);
    expect(apiHealth.body).toEqual({ status: 'ok' });
  });
});
