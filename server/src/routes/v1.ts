import { Router } from 'express';

import { env } from '../config/env.js';
import { authRouter } from './auth.routes.js';
import { businessRouter, settingsRouter } from './business.routes.js';
import { customerRouter } from './customer.routes.js';
import { healthRouter } from './health.js';
import { invoiceRouter } from './invoice.routes.js';
import { meRouter } from './me.routes.js';
import { paymentRouter } from './payment.routes.js';
import { productRouter } from './product.routes.js';
import { dashboardRouter, reportRouter } from './report.routes.js';

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
v1Router.use('/auth', authRouter);
v1Router.use('/me', meRouter);
v1Router.use('/business', businessRouter);
v1Router.use('/settings', settingsRouter);
v1Router.use('/customers', customerRouter);
v1Router.use('/products', productRouter);
v1Router.use('/invoices', invoiceRouter);
v1Router.use('/payments', paymentRouter);
v1Router.use('/dashboard', dashboardRouter);
v1Router.use('/reports', reportRouter);
