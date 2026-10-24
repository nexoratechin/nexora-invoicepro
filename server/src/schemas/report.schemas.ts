import { z } from 'zod';

const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);

    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, 'Not a real calendar date');

export const rangeQuerySchema = z
  .object({
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
  })
  .strict();

export const revenueQuerySchema = rangeQuerySchema
  .extend({
    groupBy: z.enum(['month']).default('month'),
  })
  .strict();

export const topCustomersQuerySchema = rangeQuerySchema
  .extend({
    limit: z.coerce.number().int().min(1).max(20).default(5),
  })
  .strict();

export const outstandingQuerySchema = z
  .object({
    asOf: isoDateSchema.optional(),
  })
  .strict();
