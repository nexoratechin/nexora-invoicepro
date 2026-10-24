import { z } from 'zod';

import { INVOICE_STATUSES, PAYMENT_STATES } from '@nexora/shared';

import { objectIdSchema, pagingSchema } from './common.schemas.js';

const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);

    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, 'Not a real calendar date');

const lineItemSchema = z
  .object({
    productId: objectIdSchema.nullable().optional(),
    description: z.string().trim().min(1).max(500),
    hsnSac: z.string().trim().max(12).default(''),
    unitLabel: z.string().trim().min(1).max(20).default('unit'),
    quantityMilli: z.number().int().min(1).max(1_000_000),
    unitPriceMinor: z.number().int().min(0).max(100_000_000_000),
    discountBp: z.number().int().min(0).max(10_000).default(0),
    taxRateBp: z.number().int().min(0).max(10_000),
  })
  .strict();

export const createInvoiceSchema = z
  .object({
    customerId: objectIdSchema,
    invoiceDate: isoDateSchema,
    dueDate: isoDateSchema,
    placeOfSupplyStateCode: z
      .string()
      .regex(/^\d{2}$/, 'Use a two digit state code')
      .optional(),
    notes: z.string().trim().max(2000).default(''),
    terms: z.string().trim().max(2000).default(''),
    lineItems: z.array(lineItemSchema).min(1).max(200),
  })
  .strict();

export const updateInvoiceSchema = createInvoiceSchema.partial().strict();

export const voidInvoiceSchema = z
  .object({
    reason: z.string().trim().min(3, 'Say why the invoice is being voided').max(500),
  })
  .strict();

export const listInvoicesQuerySchema = pagingSchema
  .extend({
    q: z.string().trim().max(100).optional(),
    status: z.enum(INVOICE_STATUSES).optional(),
    paymentState: z.enum(PAYMENT_STATES).optional(),
    overdue: z.enum(['true', 'false']).optional(),
    customerId: objectIdSchema.optional(),
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
  })
  .strict();

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;
export type LineItemPayload = z.infer<typeof lineItemSchema>;
