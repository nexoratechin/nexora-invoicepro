import { Router } from 'express';

import { env } from '../config/env.js';
import { healthRouter } from './health.js';

export const v1Router: Router = Router();

v1Router.get('/', (_req, res) => {
  res.json({
    name: 'Nexora InvoicePro API',
    version: 'v1',
    applicationVersion: env.APP_VERSION,
    status: 'ok',
  });
});

v1Router.use('/health', healthRouter);
