import { z } from 'zod';

import { GST_STATE_CODES, INVOICE_PREFIX_PATTERN } from '@nexora/shared';

import { addressInputSchema, optionalGstinSchema } from './common.schemas.js';

const stateCodeSchema = z
  .string()
  .trim()
  .refine((value) => value in GST_STATE_CODES, 'Choose a valid GST state code');

export const updateBusinessSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    legalName: z.string().trim().max(160).optional(),
    gstin: optionalGstinSchema.optional(),
    stateCode: stateCodeSchema.optional(),
    address: addressInputSchema.optional(),
    phone: z.string().trim().max(20).optional(),
    email: z.union([z.literal(''), z.email().max(254)]).optional(),
    website: z.string().trim().max(200).optional(),
  })
  .strict();

const bankDetailsSchema = z
  .object({
    accountName: z.string().trim().max(120).default(''),
    accountNumber: z.string().trim().max(30).default(''),
    ifsc: z.string().trim().toUpperCase().max(11).default(''),
    bankName: z.string().trim().max(120).default(''),
    upiId: z.string().trim().max(80).default(''),
  })
  .strict();

export const updateSettingsSchema = z
  .object({
    invoicePrefix: z
      .string()
      .trim()
      .toUpperCase()
      .regex(INVOICE_PREFIX_PATTERN, 'Use 3 to 8 letters or digits')
      .optional(),
    numberSeries: z.string().trim().min(1).max(12).optional(),
    defaultPaymentTermsDays: z.number().int().min(0).max(365).optional(),
    defaultTaxRateBp: z.number().int().min(0).max(10_000).optional(),
    defaultNotes: z.string().trim().max(2000).optional(),
    paymentInstructions: z.string().trim().max(2000).optional(),
    bankDetails: bankDetailsSchema.optional(),
    taxInclusivePricing: z.boolean().optional(),
  })
  .strict();
