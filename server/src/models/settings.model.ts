import { type HydratedDocument, type InferSchemaType, model, Schema, type Types } from 'mongoose';

import {
  DEFAULT_INVOICE_PREFIX,
  DEFAULT_PAYMENT_TERMS_DAYS,
  DEFAULT_TAX_RATE_BP,
} from '@nexora/shared';

import { bankDetailsSchema } from './business.model.js';
import { jsonPlugin } from './plugins.js';

const settingsSchema = new Schema(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      unique: true,
      index: true,
    },
    invoicePrefix: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      default: DEFAULT_INVOICE_PREFIX,
      match: /^[A-Z0-9]{3,8}$/,
    },
    numberSeries: { type: String, default: 'INV', trim: true, maxlength: 12 },
    defaultPaymentTermsDays: {
      type: Number,
      default: DEFAULT_PAYMENT_TERMS_DAYS,
      min: 0,
      max: 365,
    },
    defaultTaxRateBp: { type: Number, default: DEFAULT_TAX_RATE_BP, min: 0, max: 10_000 },
    defaultNotes: {
      type: String,
      default: 'Thank you for your business.',
      maxlength: 2000,
    },
    paymentInstructions: { type: String, default: '', maxlength: 2000 },
    bankDetails: { type: bankDetailsSchema, default: () => ({}) },
    taxInclusivePricing: { type: Boolean, default: false },
  },
  { timestamps: true },
);

settingsSchema.plugin(jsonPlugin);

export type BusinessSettings = InferSchemaType<typeof settingsSchema> & {
  businessId: Types.ObjectId;
};
export type BusinessSettingsDocument = HydratedDocument<BusinessSettings>;

export const BusinessSettingsModel = model('BusinessSettings', settingsSchema);
