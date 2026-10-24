import { type HydratedDocument, type InferSchemaType, model, Schema } from 'mongoose';

import { jsonPlugin } from './plugins.js';

export const addressSchema = new Schema(
  {
    line1: { type: String, trim: true, default: '', maxlength: 200 },
    line2: { type: String, trim: true, default: '', maxlength: 200 },
    city: { type: String, trim: true, default: '', maxlength: 80 },
    state: { type: String, trim: true, default: '', maxlength: 80 },
    pincode: { type: String, trim: true, default: '', maxlength: 12 },
    country: { type: String, trim: true, default: 'India', maxlength: 80 },
  },
  { _id: false },
);

export const bankDetailsSchema = new Schema(
  {
    accountName: { type: String, trim: true, default: '', maxlength: 120 },
    accountNumber: { type: String, trim: true, default: '', maxlength: 30 },
    ifsc: { type: String, trim: true, default: '', maxlength: 11 },
    bankName: { type: String, trim: true, default: '', maxlength: 120 },
    upiId: { type: String, trim: true, default: '', maxlength: 80 },
  },
  { _id: false },
);

const businessSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    legalName: { type: String, trim: true, default: '', maxlength: 160 },
    gstin: { type: String, trim: true, uppercase: true, default: '', maxlength: 15 },
    /** GST state code, two digits, drives the place of supply default. */
    stateCode: { type: String, required: true, trim: true, match: /^\d{2}$/ },
    address: { type: addressSchema, default: () => ({}) },
    phone: { type: String, trim: true, default: '', maxlength: 20 },
    email: { type: String, trim: true, lowercase: true, default: '', maxlength: 254 },
    website: { type: String, trim: true, default: '', maxlength: 200 },
    logoPath: { type: String, default: null },
    logoMime: { type: String, default: null },
    currency: { type: String, default: 'INR', maxlength: 3 },
  },
  { timestamps: true },
);

businessSchema.plugin(jsonPlugin);

export type Business = InferSchemaType<typeof businessSchema>;
export type BusinessDocument = HydratedDocument<Business>;

export const BusinessModel = model('Business', businessSchema);
