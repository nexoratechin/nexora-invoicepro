import { z } from 'zod';

import { GST_SLABS_BP } from '@nexora/shared';

import { pagingSchema } from './common.schemas.js';

const taxRateSchema = z
  .number()
  .int()
  .refine(
    (value) => (GST_SLABS_BP as readonly number[]).includes(value),
    'Use a standard GST slab: 0, 5, 12, 18 or 28 percent',
  );

export const createProductSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).default(''),
    sku: z.union([z.literal(''), z.string().trim().toUpperCase().max(40)]).default(''),
    unitLabel: z.string().trim().min(1).max(20).default('unit'),
    unitPriceMinor: z.number().int().min(0).max(1_000_000_000),
    taxRateBp: taxRateSchema,
    isActive: z.boolean().default(true),
  })
  .strict();

export const updateProductSchema = createProductSchema.partial().strict();

export const productStatusSchema = z.object({ isActive: z.boolean() }).strict();

export const listProductsQuerySchema = pagingSchema
  .extend({
    q: z.string().trim().max(100).optional(),
    isActive: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => (value === undefined ? undefined : value === 'true')),
  })
  .strict();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
