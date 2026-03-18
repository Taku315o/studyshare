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

import { __internal } from './app';

describe('rate limit store pruning', () => {
  beforeEach(() => {
    __internal.rateLimitStore.clear();
    __internal.resetRateLimitSweepState();
  });

  it('deletes expired entries when the sweep runs', () => {
    __internal.rateLimitStore.set('expired-ip', { count: 3, resetAt: 1_000 });
    __internal.rateLimitStore.set('active-ip', { count: 1, resetAt: 10_000 });

    __internal.pruneExpiredRateLimitEntries(2_000);

    expect(__internal.rateLimitStore.has('expired-ip')).toBe(false);
    expect(__internal.rateLimitStore.has('active-ip')).toBe(true);
  });

  it('skips sweeping again within the sweep interval', () => {
    __internal.rateLimitStore.set('expired-ip', { count: 3, resetAt: 1_000 });

    __internal.pruneExpiredRateLimitEntries(2_000);
    expect(__internal.rateLimitStore.has('expired-ip')).toBe(false);

    __internal.rateLimitStore.set('new-expired-ip', { count: 2, resetAt: 1_500 });
    __internal.pruneExpiredRateLimitEntries(2_500);

    expect(__internal.rateLimitStore.has('new-expired-ip')).toBe(true);
  });
});
