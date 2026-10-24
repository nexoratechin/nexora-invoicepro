import { Router } from 'express';

import { getAuth, requireAuth, requireRole } from '../middleware/auth.js';
import { updateBusinessSchema, updateSettingsSchema } from '../schemas/business.schemas.js';
import * as businessService from '../services/business.service.js';

export const businessRouter: Router = Router();

businessRouter.use(requireAuth);

businessRouter.get('/', async (req, res) => {
  const auth = getAuth(req);
  const { business, settings } = await businessService.getBusinessContext(auth.businessId);

  res.json({ business: business.toJSON(), settings: settings.toJSON() });
});

businessRouter.patch('/', requireRole('owner', 'admin'), async (req, res) => {
  const auth = getAuth(req);
  const body = updateBusinessSchema.parse(req.body);
  const business = await businessService.updateBusiness(auth.businessId, body);

  res.json({ business });
});

export const settingsRouter: Router = Router();

settingsRouter.use(requireAuth);

settingsRouter.get('/', async (req, res) => {
  const auth = getAuth(req);
  const { settings } = await businessService.getBusinessContext(auth.businessId);

  res.json({ settings: settings.toJSON() });
});

settingsRouter.put('/', requireRole('owner', 'admin'), async (req, res) => {
  const auth = getAuth(req);
  const body = updateSettingsSchema.parse(req.body);
  const settings = await businessService.updateSettings(auth.businessId, body);

  res.json({ settings });
});
