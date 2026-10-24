import { type HydratedDocument, model, Schema, type Types } from 'mongoose';

import { PAYMENT_METHODS, type PaymentMethod } from '@nexora/shared';

import { jsonPlugin } from './plugins.js';

export interface Payment {
  businessId: Types.ObjectId;
  invoiceId: Types.ObjectId;
  customerId: Types.ObjectId;
  amountMinor: number;
  paidAt: Date;
  method: PaymentMethod;
  reference: string;
  note: string;
  clientRequestId: string;
  status: 'active' | 'void';
  voidReason: string | null;
  voidedAt: Date | null;
  recordedByUserId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<Payment>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    amountMinor: { type: Number, required: true, min: 1 },
    paidAt: { type: Date, required: true },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    reference: { type: String, trim: true, default: '', maxlength: 120 },
    note: { type: String, trim: true, default: '', maxlength: 500 },
    clientRequestId: { type: String, required: true, trim: true, maxlength: 100 },
    status: { type: String, enum: ['active', 'void'], default: 'active' },
    voidReason: { type: String, default: null, maxlength: 500 },
    voidedAt: { type: Date, default: null },
    recordedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

paymentSchema.index({ businessId: 1, invoiceId: 1, createdAt: -1 });
paymentSchema.index({ businessId: 1, clientRequestId: 1 }, { unique: true });
paymentSchema.index({ businessId: 1, paidAt: -1 });

paymentSchema.plugin(jsonPlugin);

export type PaymentDocument = HydratedDocument<Payment>;

export const PaymentModel = model<Payment>('Payment', paymentSchema);
