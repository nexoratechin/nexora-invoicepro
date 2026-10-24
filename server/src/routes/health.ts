import { Router } from 'express';

import { env } from '../config/env.js';

const startedAt = Date.now();

export const healthRouter: Router = Router();

/**
 * Liveness only. It answers whether the process is serving requests, not
 * whether the database is reachable. The database probe arrives with Stage 3.
 */
healthRouter.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'nexora-invoicepro-api',
    version: env.APP_VERSION,
    environment: env.NODE_ENV,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  });
});
