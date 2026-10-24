import type { Types } from 'mongoose';

import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { addDaysIso, parseIsoDate, todayIso } from '../lib/dates.js';
import {
  BusinessModel,
  BusinessSettingsModel,
  CustomerModel,
  InvoiceModel,
  ProductModel,
  UserModel,
} from '../models/index.js';
import { registerUser } from '../services/auth.service.js';
import { createDraft, issueInvoice, voidInvoice } from '../services/invoice.service.js';
import { recordPayment } from '../services/payment.service.js';

export const DEMO_EMAIL = 'demo@nexora.test';
export const DEMO_PASSWORD = 'nexora-demo-password';
export const DEMO_BUSINESS_NAME = 'Nexora Technologies';

export interface SeedResult {
  userId: string;
  businessId: string;
  customers: number;
  products: number;
  invoices: number;
  issued: number;
  drafts: number;
  paid: number;
  partial: number;
  overdue: number;
  voided: number;
}

const CUSTOMERS = [
  { name: 'Acme Traders', email: 'billing@acme.test', stateCode: '24', gstin: '24AAAAA1111A1Z5' },
  {
    name: 'Bravo Exports',
    email: 'accounts@bravo.test',
    stateCode: '27',
    gstin: '27BBBBB2222B1Z5',
  },
  { name: 'Chai Point Retail', email: 'pay@chaipoint.test', stateCode: '24', gstin: '' },
  { name: 'Delta Systems', email: 'finance@delta.test', stateCode: '29', gstin: '29CCCCC3333C1Z5' },
  { name: 'Everest Studio', email: 'hello@everest.test', stateCode: '07', gstin: '' },
  { name: 'Foxtrot Media', email: 'ap@foxtrot.test', stateCode: '24', gstin: '24DDDDD4444D1Z5' },
];

const PRODUCTS = [
  { name: 'Website redesign', unitLabel: 'project', unitPriceMinor: 2_500_000, taxRateBp: 1800 },
  {
    name: 'Mobile app, phase one',
    unitLabel: 'project',
    unitPriceMinor: 6_000_000,
    taxRateBp: 1800,
  },
  { name: 'UI audit', unitLabel: 'day', unitPriceMinor: 1_200_000, taxRateBp: 1800 },
  { name: 'Managed hosting', unitLabel: 'month', unitPriceMinor: 50_000, taxRateBp: 1800 },
  { name: 'Support retainer', unitLabel: 'month', unitPriceMinor: 150_000, taxRateBp: 1800 },
  { name: 'Brand identity', unitLabel: 'project', unitPriceMinor: 3_500_000, taxRateBp: 1200 },
  { name: 'Content writing', unitLabel: 'page', unitPriceMinor: 80_000, taxRateBp: 500 },
  { name: 'Training workshop', unitLabel: 'session', unitPriceMinor: 400_000, taxRateBp: 0 },
];

interface InvoicePlan {
  customerIndex: number;
  productIndexes: number[];
  issuedDaysAgo: number;
  dueInDays: number;
  payment: 'none' | 'full' | 'partial';
  keepAsDraft?: boolean;
  voided?: boolean;
}

const PLAN: InvoicePlan[] = [
  { customerIndex: 0, productIndexes: [0, 3], issuedDaysAgo: 40, dueInDays: -25, payment: 'full' },
  { customerIndex: 1, productIndexes: [1], issuedDaysAgo: 35, dueInDays: -20, payment: 'partial' },
  { customerIndex: 2, productIndexes: [4], issuedDaysAgo: 30, dueInDays: -15, payment: 'none' },
  { customerIndex: 3, productIndexes: [2, 6], issuedDaysAgo: 25, dueInDays: -10, payment: 'none' },
  { customerIndex: 4, productIndexes: [5], issuedDaysAgo: 20, dueInDays: 5, payment: 'partial' },
  { customerIndex: 5, productIndexes: [7], issuedDaysAgo: 14, dueInDays: 1, payment: 'none' },
  { customerIndex: 0, productIndexes: [3, 4], issuedDaysAgo: 10, dueInDays: 5, payment: 'full' },
  { customerIndex: 1, productIndexes: [0], issuedDaysAgo: 7, dueInDays: 8, payment: 'none' },
  { customerIndex: 2, productIndexes: [6], issuedDaysAgo: 4, dueInDays: 11, payment: 'none' },
  {
    customerIndex: 3,
    productIndexes: [2],
    issuedDaysAgo: 2,
    dueInDays: 13,
    payment: 'none',
    keepAsDraft: true,
  },
  { customerIndex: 4, productIndexes: [1], issuedDaysAgo: 1, dueInDays: 14, payment: 'none' },
  {
    customerIndex: 5,
    productIndexes: [4],
    issuedDaysAgo: 1,
    dueInDays: 14,
    payment: 'none',
    voided: true,
  },
];

/**
 * Creates a labelled demo dataset through the same services the API uses, so
 * the seed cannot produce an invoice the API would refuse. Assumes an open
 * mongoose connection.
 */
export async function seedDemoData(): Promise<SeedResult> {
  const session = await registerUser(
    {
      name: 'Demo Owner',
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      businessName: DEMO_BUSINESS_NAME,
      stateCode: '24',
    },
    { userAgent: 'seed-script', ip: '127.0.0.1' },
  );

  const businessId = session.business._id;
  const userId = session.user._id;

  await BusinessModel.updateOne(
    { _id: businessId },
    {
      $set: {
        legalName: DEMO_BUSINESS_NAME,
        gstin: '24AAAAA0000A1Z5',
        phone: '+91 79 4000 0000',
        email: DEMO_EMAIL,
        website: 'https://nexoratechnologies.in',
        address: {
          line1: '14 Titanium Square',
          line2: 'Thaltej',
          city: 'Ahmedabad',
          state: 'Gujarat',
          pincode: '380059',
          country: 'India',
        },
      },
    },
  ).exec();

  await BusinessSettingsModel.updateOne(
    { businessId },
    {
      $set: {
        invoicePrefix: 'NXP',
        defaultPaymentTermsDays: 15,
        paymentInstructions: 'Pay by UPI to nexora@upi or by bank transfer to the account below.',
        bankDetails: {
          accountName: DEMO_BUSINESS_NAME,
          accountNumber: '50200012345678',
          ifsc: 'HDFC0001234',
          bankName: 'HDFC Bank',
          upiId: 'nexora@upi',
        },
      },
    },
  ).exec();

  const customers = await CustomerModel.insertMany(
    CUSTOMERS.map((spec, index) => ({
      businessId,
      name: spec.name,
      email: spec.email,
      phone: `+9198765432${String(10 + index).slice(-2)}`,
      gstin: spec.gstin,
      stateCode: spec.stateCode,
      billingAddress: {
        line1: `${String(index + 1)} Commerce Park`,
        line2: '',
        city: spec.stateCode === '27' ? 'Mumbai' : 'Ahmedabad',
        state: spec.stateCode === '27' ? 'Maharashtra' : 'Gujarat',
        pincode: spec.stateCode === '27' ? '400001' : '380059',
        country: 'India',
      },
    })),
  );

  const products = await ProductModel.insertMany(
    PRODUCTS.map((spec, index) => ({
      businessId,
      ...spec,
      sku: `NXP-${String(index + 1).padStart(3, '0')}`,
      isActive: true,
    })),
  );

  const today = todayIso();

  for (const item of PLAN) {
    const customer = customers[item.customerIndex];
    const chosen = item.productIndexes
      .map((index) => products[index])
      .filter((product) => product !== undefined);

    if (customer === undefined || chosen.length === 0) {
      continue;
    }

    const placeOfSupply = customer.stateCode === '' ? '24' : customer.stateCode;

    const draft = await createDraft(businessId, userId, {
      customerId: customer._id.toString(),
      invoiceDate: addDaysIso(today, -item.issuedDaysAgo),
      dueDate: addDaysIso(today, item.dueInDays),
      placeOfSupplyStateCode: placeOfSupply,
      notes: 'Thank you for your business.',
      terms: 'Payment within 15 days.',
      lineItems: chosen.map((product) => ({
        productId: product._id.toString(),
        description: product.name,
        hsnSac: '',
        unitLabel: product.unitLabel,
        quantityMilli: 1000,
        unitPriceMinor: product.unitPriceMinor,
        discountBp: 0,
        taxRateBp: product.taxRateBp,
      })),
    });

    const invoiceId = String((draft as { id: string }).id);

    if (item.keepAsDraft === true) {
      continue;
    }

    const issuedInvoice = await issueInvoice(businessId, userId, invoiceId);

    const total = (issuedInvoice as { totals: { totalMinor: number } }).totals.totalMinor;

    if (item.payment === 'full') {
      await recordPayment(businessId, userId, invoiceId, `seed-full-${invoiceId}`, {
        amountMinor: total,
        paidAt: addDaysIso(today, -item.issuedDaysAgo + 2),
        method: 'bank_transfer',
        reference: 'NEFT/SEED',
        note: 'Seeded full payment',
      });
    } else if (item.payment === 'partial') {
      await recordPayment(businessId, userId, invoiceId, `seed-part-${invoiceId}`, {
        amountMinor: Math.max(1, Math.floor(total / 2)),
        paidAt: addDaysIso(today, -item.issuedDaysAgo + 2),
        method: 'upi',
        reference: 'UPI/SEED',
        note: 'Seeded part payment',
      });
    }

    if (item.voided === true) {
      await voidInvoice(businessId, userId, invoiceId, 'Seeded example of a void invoice');
    }
  }

  // Count what was actually stored rather than tracking counters by hand.
  const [invoices, issued, drafts, paid, partial, overdue, voided] = await Promise.all([
    InvoiceModel.countDocuments({ businessId }).exec(),
    InvoiceModel.countDocuments({ businessId, status: 'issued' }).exec(),
    InvoiceModel.countDocuments({ businessId, status: 'draft' }).exec(),
    InvoiceModel.countDocuments({ businessId, status: 'issued', paymentState: 'paid' }).exec(),
    InvoiceModel.countDocuments({ businessId, status: 'issued', paymentState: 'partial' }).exec(),
    InvoiceModel.countDocuments({
      businessId,
      status: 'issued',
      balanceDueMinor: { $gt: 0 },
      dueDate: { $lt: parseIsoDate(today) },
    }).exec(),
    InvoiceModel.countDocuments({ businessId, status: 'void' }).exec(),
  ]);

  return {
    userId: userId.toString() as string,
    businessId: (businessId as Types.ObjectId).toString(),
    customers: customers.length,
    products: products.length,
    invoices,
    issued,
    drafts,
    paid,
    partial,
    overdue,
    voided,
  };
}

async function main(): Promise<void> {
  if (env.NODE_ENV === 'production') {
    process.stderr.write('The seed refuses to run with NODE_ENV=production.\n');
    process.exit(1);
  }

  await connectDatabase();

  const existing = await UserModel.exists({ email: DEMO_EMAIL });

  if (existing !== null) {
    logger.info(
      { email: DEMO_EMAIL },
      'The demo user already exists. Drop the database or remove that user before seeding again.',
    );
    await disconnectDatabase();

    return;
  }

  const result = await seedDemoData();

  logger.info({ ...result, email: DEMO_EMAIL, password: DEMO_PASSWORD }, 'Demo data created');

  await disconnectDatabase();
}

const isDirectRun = process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/seed.ts') === true;

if (isDirectRun) {
  main().catch((error: unknown) => {
    logger.fatal({ err: error }, 'Seeding failed');
    process.exit(1);
  });
}
