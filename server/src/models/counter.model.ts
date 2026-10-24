import { type HydratedDocument, model, Schema, type Types } from 'mongoose';

import { jsonPlugin } from './plugins.js';

export interface InvoiceCounter {
  businessId: Types.ObjectId;
  series: string;
  fiscalYear: string;
  seq: number;
}

const counterSchema = new Schema<InvoiceCounter>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    series: { type: String, required: true, default: 'INV', maxlength: 12 },
    fiscalYear: { type: String, required: true, maxlength: 9 },
    seq: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
);

counterSchema.index({ businessId: 1, series: 1, fiscalYear: 1 }, { unique: true });

counterSchema.plugin(jsonPlugin);

export type InvoiceCounterDocument = HydratedDocument<InvoiceCounter>;

export const InvoiceCounterModel = model<InvoiceCounter>('InvoiceCounter', counterSchema);
