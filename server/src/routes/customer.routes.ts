import { Router } from 'express';

import { getAuth, requireAuth, requireRole } from '../middleware/auth.js';
import { objectIdSchema } from '../schemas/common.schemas.js';
import {
  createCustomerSchema,
  listCustomersQuerySchema,
  updateCustomerSchema,
} from '../schemas/customer.schemas.js';
import * as customerService from '../services/customer.service.js';

export const customerRouter: Router = Router();

customerRouter.use(requireAuth);

customerRouter.get('/', async (req, res) => {
  const auth = getAuth(req);
  const query = listCustomersQuerySchema.parse(req.query);

  res.json(await customerService.listCustomers(auth.businessId, query));
});

customerRouter.post('/', async (req, res) => {
  const auth = getAuth(req);
  const body = createCustomerSchema.parse(req.body);
  const customer = await customerService.createCustomer(auth.businessId, body);

  res.status(201).json({ customer });
});

customerRouter.get('/:id', async (req, res) => {
  const auth = getAuth(req);
  const id = objectIdSchema.parse(req.params.id);

  res.json(await customerService.getCustomer(auth.businessId, id));
});

customerRouter.patch('/:id', async (req, res) => {
  const auth = getAuth(req);
  const id = objectIdSchema.parse(req.params.id);
  const body = updateCustomerSchema.parse(req.body);
  const customer = await customerService.updateCustomer(auth.businessId, id, body);

  res.json({ customer });
});

customerRouter.post('/:id/archive', async (req, res) => {
  const auth = getAuth(req);
  const id = objectIdSchema.parse(req.params.id);
  const customer = await customerService.setCustomerStatus(auth.businessId, id, 'archived');

  res.json({ customer });
});

customerRouter.post('/:id/restore', async (req, res) => {
  const auth = getAuth(req);
  const id = objectIdSchema.parse(req.params.id);
  const customer = await customerService.setCustomerStatus(auth.businessId, id, 'active');

  res.json({ customer });
});

customerRouter.delete('/:id', requireRole('owner', 'admin'), async (req, res) => {
  const auth = getAuth(req);
  const id = objectIdSchema.parse(req.params.id);

  await customerService.deleteCustomer(auth.businessId, id);

  res.status(204).end();
});
