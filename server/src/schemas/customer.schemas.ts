import { z } from 'zod';

import { CUSTOMER_STATUSES, GST_STATE_CODES } from '@nexora/shared';

import { addressInputSchema, optionalGstinSchema, pagingSchema } from './common.schemas.js';

const stateCodeSchema = z
  .string()
  .trim()
  .refine((value) => value === '' || value in GST_STATE_CODES, 'Choose a valid GST state code')
  .default('');

export const createCustomerSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.union([z.literal(''), z.email().max(254)]).default(''),
    phone: z.string().trim().max(20).default(''),
    gstin: optionalGstinSchema,
    stateCode: stateCodeSchema,
    billingAddress: addressInputSchema.optional(),
    shippingAddress: addressInputSchema.optional(),
    notes: z.string().trim().max(1000).default(''),
  })
  .strict();

export const updateCustomerSchema = createCustomerSchema.partial().strict();

export const listCustomersQuerySchema = pagingSchema
  .extend({
    q: z.string().trim().max(100).optional(),
    status: z.enum(CUSTOMER_STATUSES).optional(),
  })
  .strict();

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;
