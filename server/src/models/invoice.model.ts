import { type HydratedDocument, model, Schema, type Types } from 'mongoose';

import type { ComputedLineItem, InvoiceTotals, TaxTreatment } from '@nexora/shared';

import { jsonPlugin } from './plugins.js';

export type InvoiceLineItem = Omit<ComputedLineItem, 'productId'> & {
  productId: Types.ObjectId | null;
};

export interface InvoiceCustomerSnapshot {
  name: string;
  gstin: string;
  email: string;
  phone: string;
  billingAddress: Record<string, string>;
  stateCode: string;
}

export interface InvoiceBusinessSnapshot {
  name: string;
  gstin: string;
  address: Record<string, string>;
  stateCode: string;
  phone: string;
  email: string;
  logoPath: string | null;
  bankDetails: Record<string, string>;
}

export type InvoiceEventType = 'created' | 'updated' | 'issued' | 'void' | 'payment';

export interface InvoiceEvent {
  type: InvoiceEventType;
  message: string;
  actorUserId: Types.ObjectId | null;
  meta?: Record<string, unknown>;
  createdAt: Date;
}

export interface Invoice {
  businessId: Types.ObjectId;
  customerId: Types.ObjectId;
  invoiceNumber: string | null;
  status: 'draft' | 'issued' | 'void';
  paymentState: 'unpaid' | 'partial' | 'paid';
  invoiceDate: Date;
  dueDate: Date;
  placeOfSupplyStateCode: string;
  taxTreatment: TaxTreatment;
  lineItems: InvoiceLineItem[];
  totals: InvoiceTotals;
  amountPaidMinor: number;
  balanceDueMinor: number;
  customerSnapshot: InvoiceCustomerSnapshot | null;
  businessSnapshot: InvoiceBusinessSnapshot | null;
  notes: string;
  terms: string;
  voidReason: string | null;
  issuedAt: Date | null;
  voidedAt: Date | null;
  events: InvoiceEvent[];
  createdAt: Date;
  updatedAt: Date;
}

const lineItemSchema = new Schema<InvoiceLineItem>(
  {
    lineNo: { type: Number, required: true, min: 1 },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', default: null },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    hsnSac: { type: String, trim: true, default: '', maxlength: 12 },
    unitLabel: { type: String, trim: true, default: 'unit', maxlength: 20 },
    quantityMilli: { type: Number, required: true, min: 1 },
    unitPriceMinor: { type: Number, required: true, min: 0 },
    discountBp: { type: Number, required: true, default: 0, min: 0, max: 10_000 },
    grossMinor: { type: Number, required: true, min: 0 },
    discountMinor: { type: Number, required: true, min: 0 },
    taxableMinor: { type: Number, required: true, min: 0 },
    taxRateBp: { type: Number, required: true, min: 0, max: 10_000 },
    taxTreatment: { type: String, enum: ['intra', 'inter'], required: true },
    cgstMinor: { type: Number, required: true, min: 0 },
    sgstMinor: { type: Number, required: true, min: 0 },
    igstMinor: { type: Number, required: true, min: 0 },
    taxMinor: { type: Number, required: true, min: 0 },
    lineTotalMinor: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const totalsSchema = new Schema<InvoiceTotals>(
  {
    subtotalMinor: { type: Number, required: true, min: 0 },
    discountTotalMinor: { type: Number, required: true, min: 0 },
    taxableTotalMinor: { type: Number, required: true, min: 0 },
    cgstTotalMinor: { type: Number, required: true, min: 0 },
    sgstTotalMinor: { type: Number, required: true, min: 0 },
    igstTotalMinor: { type: Number, required: true, min: 0 },
    taxTotalMinor: { type: Number, required: true, min: 0 },
    roundOffMinor: { type: Number, required: true, default: 0 },
    totalMinor: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const customerSnapshotSchema = new Schema<InvoiceCustomerSnapshot>(
  {
    name: { type: String, default: '' },
    gstin: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    billingAddress: { type: Schema.Types.Mixed, default: {} },
    stateCode: { type: String, default: '' },
  },
  { _id: false },
);

const businessSnapshotSchema = new Schema<InvoiceBusinessSnapshot>(
  {
    name: { type: String, default: '' },
    gstin: { type: String, default: '' },
    address: { type: Schema.Types.Mixed, default: {} },
    stateCode: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    logoPath: { type: String, default: null },
    bankDetails: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const eventSchema = new Schema<InvoiceEvent>(
  {
    type: {
      type: String,
      enum: ['created', 'updated', 'issued', 'void', 'payment'],
      required: true,
    },
    message: { type: String, required: true, maxlength: 500 },
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    meta: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const invoiceSchema = new Schema<Invoice>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    invoiceNumber: { type: String, default: null },
    status: { type: String, enum: ['draft', 'issued', 'void'], default: 'draft', required: true },
    paymentState: {
      type: String,
      enum: ['unpaid', 'partial', 'paid'],
      default: 'unpaid',
      required: true,
    },
    invoiceDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    placeOfSupplyStateCode: { type: String, required: true, match: /^\d{2}$/ },
    taxTreatment: { type: String, enum: ['intra', 'inter'], required: true },
    lineItems: { type: [lineItemSchema], default: [] },
    totals: { type: totalsSchema, required: true },
    amountPaidMinor: { type: Number, default: 0, min: 0 },
    balanceDueMinor: { type: Number, default: 0, min: 0 },
    customerSnapshot: { type: customerSnapshotSchema, default: null },
    businessSnapshot: { type: businessSnapshotSchema, default: null },
    notes: { type: String, default: '', maxlength: 2000 },
    terms: { type: String, default: '', maxlength: 2000 },
    voidReason: { type: String, default: null, maxlength: 500 },
    issuedAt: { type: Date, default: null },
    voidedAt: { type: Date, default: null },
    events: { type: [eventSchema], default: [] },
  },
  { timestamps: true },
);

invoiceSchema.index(
  { businessId: 1, invoiceNumber: 1 },
  { unique: true, partialFilterExpression: { invoiceNumber: { $type: 'string' } } },
);
invoiceSchema.index({ businessId: 1, status: 1, invoiceDate: -1 });
invoiceSchema.index({ businessId: 1, paymentState: 1, dueDate: 1 });
invoiceSchema.index({ businessId: 1, customerId: 1, invoiceDate: -1 });
invoiceSchema.index({ businessId: 1, status: 1, dueDate: 1, balanceDueMinor: 1 });

invoiceSchema.plugin(jsonPlugin);

export type InvoiceDocument = HydratedDocument<Invoice>;

export const InvoiceModel = model<Invoice>('Invoice', invoiceSchema);
