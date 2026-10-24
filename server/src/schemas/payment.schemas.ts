import { z } from 'zod';

import { PAYMENT_METHODS } from '@nexora/shared';

import { objectIdSchema, pagingSchema } from './common.schemas.js';

const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);

    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, 'Not a real calendar date');

export const recordPaymentSchema = z
  .object({
    amountMinor: z.number().int().min(1),
    paidAt: isoDateSchema,
    method: z.enum(PAYMENT_METHODS),
    reference: z.string().trim().max(120).default(''),
    note: z.string().trim().max(500).default(''),
  })
  .strict();

export const voidPaymentSchema = z
  .object({
    reason: z.string().trim().min(3, 'Say why the payment is being voided').max(500),
  })
  .strict();

export const listPaymentsQuerySchema = pagingSchema
  .extend({
    q: z.string().trim().max(100).optional(),
    invoiceId: objectIdSchema.optional(),
    customerId: objectIdSchema.optional(),
    method: z.enum(PAYMENT_METHODS).optional(),
    status: z.enum(['active', 'void']).optional(),
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
  })
  .strict();

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;
