import { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { InvoiceModel } from '../models/index.js';
import {
  app,
  authHeader,
  createCustomer,
  registerAccount,
  type TestSession,
} from './helpers/api.js';
import { clearDatabase, connectTestDb, disconnectTestDb } from './helpers/test-db.js';

const COUNT = 10_000;

const totals = {
  subtotalMinor: 100_000,
  discountTotalMinor: 0,
  taxableTotalMinor: 100_000,
  cgstTotalMinor: 9000,
  sgstTotalMinor: 9000,
  igstTotalMinor: 0,
  taxTotalMinor: 18_000,
  roundOffMinor: 0,
  totalMinor: 118_000,
};

const line = {
  lineNo: 1,
  productId: null,
  description: 'Managed hosting, one month',
  hsnSac: '998314',
  unitLabel: 'month',
  quantityMilli: 1000,
  unitPriceMinor: 100_000,
  discountBp: 0,
  grossMinor: 100_000,
  discountMinor: 0,
  taxableMinor: 100_000,
  taxRateBp: 1800,
  taxTreatment: 'intra' as const,
  cgstMinor: 9000,
  sgstMinor: 9000,
  igstMinor: 0,
  taxMinor: 18_000,
  lineTotalMinor: 118_000,
};

let session: TestSession;

beforeAll(async () => {
  await connectTestDb();
  await clearDatabase();
  session = await registerAccount({ stateCode: '24' });

  const customerId = await createCustomer(session, { stateCode: '24' });
  const businessId = new Types.ObjectId(session.businessId);
  const customerObjectId = new Types.ObjectId(customerId);
  const now = Date.now();

  const documents = Array.from({ length: COUNT }, (_, index) => ({
    businessId,
    customerId: customerObjectId,
    invoiceNumber: `PERF/2026-27/${String(index + 1).padStart(5, '0')}`,
    status: 'issued',
    paymentState: index % 5 === 0 ? 'paid' : 'unpaid',
    invoiceDate: new Date(now - (index % 90) * 24 * 60 * 60 * 1000),
    dueDate: new Date(now - (index % 90) * 24 * 60 * 60 * 1000 + 15 * 24 * 60 * 60 * 1000),
    placeOfSupplyStateCode: '24',
    taxTreatment: 'intra',
    lineItems: [line],
    totals,
    amountPaidMinor: index % 5 === 0 ? totals.totalMinor : 0,
    balanceDueMinor: index % 5 === 0 ? 0 : totals.totalMinor,
    notes: '',
    terms: '',
    events: [],
  }));

  await InvoiceModel.insertMany(documents, { ordered: false });
}, 180_000);

afterAll(async () => {
  await disconnectTestDb();
});

async function time(path: string): Promise<{ ms: number; body: Record<string, unknown> }> {
  const started = process.hrtime.bigint();
  const response = await request(app).get(path).set(authHeader(session)).expect(200);
  const ms = Number(process.hrtime.bigint() - started) / 1_000_000;

  process.stdout.write(`  ${path} -> ${ms.toFixed(0)}ms\n`);

  return { ms, body: response.body as Record<string, unknown> };
}

describe(`with ${String(COUNT)} invoices`, () => {
  it('lists the first page quickly and reports the right total', async () => {
    const { ms, body } = await time('/api/v1/invoices?pageSize=20&sort=-invoiceDate');

    expect(body.total).toBe(COUNT);
    expect((body.items as unknown[]).length).toBe(20);
    expect(ms).toBeLessThan(2000);
  });

  it('searches by invoice number without a full collection scan timeout', async () => {
    const { ms, body } = await time('/api/v1/invoices?q=PERF%2F2026-27%2F09999');

    expect(body.total).toBe(1);
    expect(ms).toBeLessThan(2000);
  });

  it('filters overdue invoices', async () => {
    const { ms, body } = await time('/api/v1/invoices?overdue=true&pageSize=20');

    expect(body.total).toBeGreaterThan(0);
    expect(ms).toBeLessThan(2000);
  });

  it('builds the dashboard over a year of invoices', async () => {
    const { ms, body } = await time('/api/v1/dashboard?from=2020-01-01&to=2030-12-31');

    expect((body.counts as { total: number }).total).toBe(COUNT);
    expect(ms).toBeLessThan(3000);
  });

  it('aggregates the GST report', async () => {
    const { ms, body } = await time('/api/v1/reports/gst?from=2020-01-01&to=2030-12-31');

    expect((body.totals as { taxMinor: number }).taxMinor).toBe(18_000 * COUNT);
    expect(ms).toBeLessThan(3000);
  });

  it('has the indexes the list filters rely on', async () => {
    const indexes = await InvoiceModel.collection.indexes();
    const keys = indexes.map((index) => Object.keys(index.key).join(','));

    expect(keys).toContain('businessId,invoiceNumber');
    expect(keys).toContain('businessId,status,invoiceDate');
    expect(keys).toContain('businessId,status,dueDate,balanceDueMinor');
  });
});
