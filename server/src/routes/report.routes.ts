import { Router } from 'express';

import { getAuth, requireAuth } from '../middleware/auth.js';
import {
  outstandingQuerySchema,
  rangeQuerySchema,
  revenueQuerySchema,
  topCustomersQuerySchema,
} from '../schemas/report.schemas.js';
import * as reportService from '../services/report.service.js';

export const dashboardRouter: Router = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get('/', async (req, res) => {
  const auth = getAuth(req);
  const query = rangeQuerySchema.parse(req.query);

  res.json(await reportService.getDashboard(auth.businessId, query.from, query.to));
});

export const reportRouter: Router = Router();

reportRouter.use(requireAuth);

reportRouter.get('/summary', async (req, res) => {
  const auth = getAuth(req);
  const query = rangeQuerySchema.parse(req.query);

  res.json(await reportService.getSummary(auth.businessId, query.from, query.to));
});

reportRouter.get('/revenue', async (req, res) => {
  const auth = getAuth(req);
  const query = revenueQuerySchema.parse(req.query);

  res.json(await reportService.getRevenueByMonth(auth.businessId, query.from, query.to));
});

reportRouter.get('/outstanding', async (req, res) => {
  const auth = getAuth(req);
  const query = outstandingQuerySchema.parse(req.query);

  res.json(await reportService.getOutstandingAging(auth.businessId, query.asOf));
});

reportRouter.get('/gst', async (req, res) => {
  const auth = getAuth(req);
  const query = rangeQuerySchema.parse(req.query);

  res.json(await reportService.getGstSummary(auth.businessId, query.from, query.to));
});

reportRouter.get('/top-customers', async (req, res) => {
  const auth = getAuth(req);
  const query = topCustomersQuerySchema.parse(req.query);

  res.json(await reportService.getTopCustomers(auth.businessId, query.from, query.to, query.limit));
});
