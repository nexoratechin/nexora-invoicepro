import { z } from 'zod';

import { GSTIN_PATTERN, GST_SLABS_BP, GST_STATE_CODES } from '@nexora/shared';

const stateCodeSchema = z
  .string()
  .trim()
  .refine((value) => value in GST_STATE_CODES, 'Choose a state');

const gstinSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || GSTIN_PATTERN.test(value.toUpperCase()),
    'A GSTIN looks like 24AAAAA0000A1Z5',
  );

const gstRateSchema = z
  .string()
  .trim()
  .refine(
    (value) => (GST_SLABS_BP as readonly number[]).includes(Number(value)),
    'Choose a standard GST slab',
  );

export const rupeeSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, 'Enter an amount like 1250.50');

export const quantitySchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,3})?$/, 'Enter a quantity like 1.5')
  .refine((value) => Number(value) > 0, 'Quantity must be more than zero');

export const loginFormSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

export const registerFormSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(80),
  email: z.email('Enter a valid email address'),
  password: z.string().min(10, 'Use at least 10 characters').max(128),
  businessName: z.string().trim().min(2, 'Enter your business name').max(120),
  stateCode: stateCodeSchema,
});

const addressFields = {
  line1: z.string().trim().max(200),
  line2: z.string().trim().max(200),
  city: z.string().trim().max(80),
  state: z.string().trim().max(80),
  pincode: z.string().trim().max(12),
};

export const customerFormSchema = z.object({
  name: z.string().trim().min(2, 'Enter the customer name').max(120),
  email: z.union([z.literal(''), z.email('Enter a valid email address')]),
  phone: z.string().trim().max(20),
  gstin: gstinSchema,
  stateCode: z.string().trim(),
  notes: z.string().trim().max(1000),
  ...addressFields,
});

export const productFormSchema = z.object({
  name: z.string().trim().min(2, 'Enter the product name').max(120),
  description: z.string().trim().max(500),
  sku: z.string().trim().max(40),
  unitLabel: z.string().trim().min(1, 'Add a unit').max(20),
  unitPrice: rupeeSchema,
  taxRateBp: gstRateSchema,
  isActive: z.boolean(),
});

export const lineItemFormSchema = z.object({
  productId: z.string(),
  description: z.string().trim().min(1, 'Describe the line').max(500),
  hsnSac: z.string().trim().max(12),
  unitLabel: z.string().trim().min(1).max(20),
  quantity: quantitySchema,
  unitPrice: rupeeSchema,
  discountPercent: z
    .string()
    .trim()
    .regex(/^\d{1,3}(\.\d{1,2})?$/, 'Use a percentage like 5')
    .refine((value) => Number(value) <= 100, 'Cannot exceed 100'),
  taxRateBp: gstRateSchema,
});

export const invoiceFormSchema = z
  .object({
    customerId: z.string().min(1, 'Choose a customer'),
    invoiceDate: z.string().min(1, 'Choose an invoice date'),
    dueDate: z.string().min(1, 'Choose a due date'),
    placeOfSupplyStateCode: stateCodeSchema,
    notes: z.string().trim().max(2000),
    terms: z.string().trim().max(2000),
    lineItems: z.array(lineItemFormSchema).min(1, 'Add at least one line'),
  })
  .refine((values) => values.dueDate >= values.invoiceDate, {
    path: ['dueDate'],
    message: 'The due date cannot be before the invoice date',
  });

export const paymentFormSchema = z.object({
  amount: rupeeSchema,
  paidAt: z.string().min(1, 'Choose the payment date'),
  method: z.enum(['cash', 'upi', 'bank_transfer', 'cheque', 'card', 'other']),
  reference: z.string().trim().max(120),
  note: z.string().trim().max(500),
});

export const businessFormSchema = z.object({
  name: z.string().trim().min(2, 'Enter the business name').max(120),
  legalName: z.string().trim().max(160),
  gstin: gstinSchema,
  stateCode: stateCodeSchema,
  phone: z.string().trim().max(20),
  email: z.union([z.literal(''), z.email('Enter a valid email address')]),
  website: z.string().trim().max(200),
  ...addressFields,
});

export const settingsFormSchema = z.object({
  invoicePrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{3,8}$/, 'Use 3 to 8 letters or digits'),
  defaultPaymentTermsDays: z
    .string()
    .trim()
    .regex(/^\d{1,3}$/, 'Use whole days')
    .refine((value) => Number(value) <= 365, 'Use 365 days or fewer'),
  defaultTaxRateBp: gstRateSchema,
  defaultNotes: z.string().trim().max(2000),
  paymentInstructions: z.string().trim().max(2000),
  accountName: z.string().trim().max(120),
  accountNumber: z.string().trim().max(30),
  ifsc: z.string().trim().max(11),
  bankName: z.string().trim().max(120),
  upiId: z.string().trim().max(80),
});

export const profileFormSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(80),
  phone: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || /^\+?[0-9]{8,15}$/.test(value),
      'Use 8 to 15 digits, optionally starting with +',
    ),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;
export type RegisterFormValues = z.infer<typeof registerFormSchema>;
export type CustomerFormValues = z.infer<typeof customerFormSchema>;
export type ProductFormValues = z.infer<typeof productFormSchema>;
export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;
export type InvoiceLineFormValues = z.infer<typeof lineItemFormSchema>;
export type PaymentFormValues = z.infer<typeof paymentFormSchema>;
export type BusinessFormValues = z.infer<typeof businessFormSchema>;
export type SettingsFormValues = z.infer<typeof settingsFormSchema>;
export type ProfileFormValues = z.infer<typeof profileFormSchema>;

export function emptyLineItem(): InvoiceLineFormValues {
  return {
    productId: '',
    description: '',
    hsnSac: '',
    unitLabel: 'unit',
    quantity: '1',
    unitPrice: '0.00',
    discountPercent: '0',
    taxRateBp: '1800',
  };
}

export function emptyAddress(): Pick<
  CustomerFormValues,
  'line1' | 'line2' | 'city' | 'state' | 'pincode'
> {
  return { line1: '', line2: '', city: '', state: '', pincode: '' };
}
