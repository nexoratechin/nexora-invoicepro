import { Router } from 'express';

import { getAuth, requireAuth } from '../middleware/auth.js';
import { updateProfileSchema } from '../schemas/auth.schemas.js';
import * as authService from '../services/auth.service.js';

export const meRouter: Router = Router();

meRouter.use(requireAuth);

meRouter.get('/', async (req, res) => {
  const auth = getAuth(req);
  const session = await authService.currentSession(auth.userId, auth.businessId);

  res.json({
    user: session.user.toJSON(),
    business: session.business.toJSON(),
    settings: session.settings === null ? null : session.settings.toJSON(),
    role: auth.role,
  });
});

meRouter.patch('/', async (req, res) => {
  const auth = getAuth(req);
  const body = updateProfileSchema.parse(req.body);
  const user = await authService.updateProfile(auth.userId, body);

  res.json({ user: user.toJSON() });
});
