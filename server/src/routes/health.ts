import mongoose from 'mongoose';

import { env } from '../config/env.js';
import { isDatabaseReady } from '../config/db.js';
import { Router } from 'express';

const startedAt = Date.now();

export const healthRouter: Router = Router();

/**
 * Liveness only. It answers whether the process is serving requests, not
 * whether the database is reachable.
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

/** Readiness. Returns 503 when MongoDB is not connected. */
healthRouter.get('/db', (_req, res) => {
  if (!isDatabaseReady()) {
    res.status(503).json({
      status: 'unavailable',
      code: 'DATABASE_UNAVAILABLE',
      database: mongoose.connection.readyState,
    });

    return;
  }

  res.json({
    status: 'ok',
    database: mongoose.connection.name,
    host: mongoose.connection.host,
  });
});
