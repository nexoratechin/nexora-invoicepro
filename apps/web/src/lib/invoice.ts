import {
  computeInvoice,
  parseRupeeAmount,
  resolveTaxTreatment,
  type InvoiceTotals,
  type PaymentMethod,
  type TaxTreatment,
} from '@nexora/shared';

import type { InvoiceLineFormValues, InvoiceFormValues } from './validation';

export interface ApiInvoiceLine {
  lineNo: number;
  productId: string | null;
  description: string;
  hsnSac: string;
  unitLabel: string;
  quantityMilli: number;
  unitPriceMinor: number;
  discountBp: number;
  grossMinor: number;
  discountMinor: number;
  taxableMinor: number;
  taxRateBp: number;
  taxTreatment: TaxTreatment;
  cgstMinor: number;
  sgstMinor: number;
  igstMinor: number;
  taxMinor: number;
  lineTotalMinor: number;
}

export interface ApiInvoice {
  id: string;
  customerId: string | { _id?: string; id?: string; name?: string; email?: string };
  invoiceNumber: string | null;
  status: 'draft' | 'issued' | 'void';
  paymentState: 'unpaid' | 'partial' | 'paid';
  invoiceDate: string;
  dueDate: string;
  placeOfSupplyStateCode: string;
  taxTreatment: TaxTreatment;
  lineItems: ApiInvoiceLine[];
  totals: InvoiceTotals;
  amountPaidMinor: number;
  balanceDueMinor: number;
  customerSnapshot: { name?: string } | null;
  notes: string;
  terms: string;
  voidReason: string | null;
  issuedAt: string | null;
  voidedAt: string | null;
  overdue: boolean;
  events?: { type: string; message: string; createdAt: string }[];
  createdAt: string;
}

export interface ApiPayment {
  id: string;
  invoiceId: string | { _id?: string; id?: string; invoiceNumber?: string | null };
  amountMinor: number;
  paidAt: string;
  method: PaymentMethod;
  reference: string;
  note: string;
  status: 'active' | 'void';
  voidReason: string | null;
  createdAt: string;
}

export interface ApiCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  gstin: string;
  stateCode: string;
  status: 'active' | 'archived';
  notes: string;
  billingAddress: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  createdAt: string;
}

export interface ApiProduct {
  id: string;
  name: string;
  description: string;
  sku: string | null;
  unitLabel: string;
  unitPriceMinor: number;
  taxRateBp: number;
  isActive: boolean;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function invoiceCustomerId(invoice: ApiInvoice): string {
  const value = invoice.customerId;

  return typeof value === 'string' ? value : (value._id ?? value.id ?? '');
}

export function invoiceCustomerName(invoice: ApiInvoice): string {
  const value = invoice.customerId;

  if (typeof value !== 'string' && typeof value.name === 'string') {
    return value.name;
  }

  return invoice.customerSnapshot?.name ?? 'Customer';
}

export function paymentInvoiceNumber(payment: ApiPayment): string {
  const value = payment.invoiceId;

  if (typeof value !== 'string' && typeof value.invoiceNumber === 'string') {
    return value.invoiceNumber;
  }

  return 'Invoice';
}

export function percentToBasisPoints(percent: string): number {
  const value = Number(percent);

  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value * 100);
}

export function quantityToMilli(quantity: string): number {
  const [whole = '0', fraction = ''] = quantity.split('.');

  return Number(whole) * 1000 + Number(fraction.padEnd(3, '0').slice(0, 3));
}

export interface LinePayload {
  productId?: string;
  description: string;
  hsnSac: string;
  unitLabel: string;
  quantityMilli: number;
  unitPriceMinor: number;
  discountBp: number;
  taxRateBp: number;
}

export function lineToPayload(line: InvoiceLineFormValues): LinePayload {
  return {
    ...(line.productId === '' ? {} : { productId: line.productId }),
    description: line.description,
    hsnSac: line.hsnSac,
    unitLabel: line.unitLabel,
    quantityMilli: quantityToMilli(line.quantity),
    unitPriceMinor: parseRupeeAmount(line.unitPrice),
    discountBp: percentToBasisPoints(line.discountPercent),
    taxRateBp: Number(line.taxRateBp),
  };
}

export function invoiceToPayload(values: InvoiceFormValues): {
  customerId: string;
  invoiceDate: string;
  dueDate: string;
  placeOfSupplyStateCode: string;
  notes: string;
  terms: string;
  lineItems: LinePayload[];
} {
  return {
    customerId: values.customerId,
    invoiceDate: values.invoiceDate,
    dueDate: values.dueDate,
    placeOfSupplyStateCode: values.placeOfSupplyStateCode,
    notes: values.notes,
    terms: values.terms,
    lineItems: values.lineItems.map(lineToPayload),
  };
}

/**
 * The same shared functions the server uses, so the preview on screen matches
 * what will be stored. Returns null while the form is still incomplete.
 */
export function previewTotals(
  lines: InvoiceLineFormValues[],
  businessStateCode: string,
  placeOfSupplyStateCode: string,
): { totals: InvoiceTotals; taxTreatment: TaxTreatment } | null {
  try {
    const treatment = resolveTaxTreatment(businessStateCode, placeOfSupplyStateCode);
    const { totals } = computeInvoice(
      lines.map((line) => ({
        description: line.description === '' ? 'Line' : line.description,
        quantityMilli: quantityToMilli(line.quantity),
        unitPriceMinor: parseRupeeAmount(line.unitPrice),
        discountBp: percentToBasisPoints(line.discountPercent),
        taxRateBp: Number(line.taxRateBp),
      })),
      treatment,
    );

    return { totals, taxTreatment: treatment };
  } catch {
    return null;
  }
}
