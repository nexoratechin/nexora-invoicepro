import { type HydratedDocument, type InferSchemaType, model, Schema, type Types } from 'mongoose';

import { CUSTOMER_STATUSES } from '@nexora/shared';

import { addressSchema } from './business.model.js';
import { jsonPlugin } from './plugins.js';

const customerSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    email: { type: String, trim: true, lowercase: true, default: '', maxlength: 254 },
    phone: { type: String, trim: true, default: '', maxlength: 20 },
    gstin: { type: String, trim: true, uppercase: true, default: '', maxlength: 15 },
    stateCode: { type: String, trim: true, default: '', maxlength: 2 },
    billingAddress: { type: addressSchema, default: () => ({}) },
    shippingAddress: { type: addressSchema, default: () => ({}) },
    notes: { type: String, default: '', maxlength: 1000 },
    status: { type: String, enum: CUSTOMER_STATUSES, default: 'active' },
  },
  { timestamps: true },
);

customerSchema.index({ businessId: 1, status: 1, name: 1 });
customerSchema.index({ businessId: 1, email: 1 });
customerSchema.index({ businessId: 1, name: 1 });

customerSchema.plugin(jsonPlugin);

export type Customer = InferSchemaType<typeof customerSchema> & { businessId: Types.ObjectId };
export type CustomerDocument = HydratedDocument<Customer>;

export const CustomerModel = model('Customer', customerSchema);
