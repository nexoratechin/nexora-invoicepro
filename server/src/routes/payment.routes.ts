import { Router } from 'express';

import { getAuth, requireAuth, requireRole } from '../middleware/auth.js';
import { objectIdSchema } from '../schemas/common.schemas.js';
import { listPaymentsQuerySchema, voidPaymentSchema } from '../schemas/payment.schemas.js';
import * as paymentService from '../services/payment.service.js';

export const paymentRouter: Router = Router();

paymentRouter.use(requireAuth);

paymentRouter.get('/', async (req, res) => {
  const auth = getAuth(req);
  const query = listPaymentsQuerySchema.parse(req.query);

  res.json(await paymentService.listPayments(auth.businessId, query));
});

paymentRouter.get('/:id', async (req, res) => {
  const auth = getAuth(req);
  const id = objectIdSchema.parse(req.params.id);

  res.json({ payment: await paymentService.getPayment(auth.businessId, id) });
});

paymentRouter.post('/:id/void', requireRole('owner', 'admin'), async (req, res) => {
  const auth = getAuth(req);
  const id = objectIdSchema.parse(req.params.id);
  const body = voidPaymentSchema.parse(req.body);

  res.json(await paymentService.voidPayment(auth.businessId, auth.userId, id, body.reason));
});
