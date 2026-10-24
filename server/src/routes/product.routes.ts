import { Router } from 'express';

import { getAuth, requireAuth, requireRole } from '../middleware/auth.js';
import { objectIdSchema } from '../schemas/common.schemas.js';
import {
  createProductSchema,
  listProductsQuerySchema,
  productStatusSchema,
  updateProductSchema,
} from '../schemas/product.schemas.js';
import * as productService from '../services/product.service.js';

export const productRouter: Router = Router();

productRouter.use(requireAuth);

productRouter.get('/', async (req, res) => {
  const auth = getAuth(req);
  const query = listProductsQuerySchema.parse(req.query);

  res.json(await productService.listProducts(auth.businessId, query));
});

productRouter.post('/', async (req, res) => {
  const auth = getAuth(req);
  const body = createProductSchema.parse(req.body);
  const product = await productService.createProduct(auth.businessId, body);

  res.status(201).json({ product });
});

productRouter.get('/:id', async (req, res) => {
  const auth = getAuth(req);
  const id = objectIdSchema.parse(req.params.id);

  res.json({ product: await productService.getProduct(auth.businessId, id) });
});

productRouter.patch('/:id', async (req, res) => {
  const auth = getAuth(req);
  const id = objectIdSchema.parse(req.params.id);
  const body = updateProductSchema.parse(req.body);
  const product = await productService.updateProduct(auth.businessId, id, body);

  res.json({ product });
});

productRouter.post('/:id/status', async (req, res) => {
  const auth = getAuth(req);
  const id = objectIdSchema.parse(req.params.id);
  const body = productStatusSchema.parse(req.body);
  const product = await productService.setProductStatus(auth.businessId, id, body.isActive);

  res.json({ product });
});

productRouter.delete('/:id', requireRole('owner', 'admin'), async (req, res) => {
  const auth = getAuth(req);
  const id = objectIdSchema.parse(req.params.id);

  await productService.deleteProduct(auth.businessId, id);

  res.status(204).end();
});
