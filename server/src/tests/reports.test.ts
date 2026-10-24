import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  app,
  authHeader,
  createCustomer,
  createInvoice,
  issueInvoice,
  recordPayment,
  registerAccount,
  type TestSession,
} from './helpers/api.js';
import { clearDatabase, connectTestDb, disconnectTestDb } from './helpers/test-db.js';

const TOTAL = 3_622_600;
const RANGE = 'from=2026-01-01&to=2026-12-31';

let session: TestSession;

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

beforeEach(async () => {
  await clearDatabase();
  session = await registerAccount({ stateCode: '24' });

  const customerId = await createCustomer(session, {
    name: 'Acme Traders',
    stateCode: '24',
  });

  // Paid in full.
  const paid = await createInvoice(session, customerId);
  await issueInvoice(session, paid.id);
  await recordPayment(session, paid.id, { amountMinor: TOTAL });

  // Partly paid, not yet due.
  const partial = await createInvoice(session, customerId);
  await issueInvoice(session, partial.id);
  await recordPayment(session, partial.id, { amountMinor: 1_000_000 });

  // Overdue and unpaid.
  const overdue = await createInvoice(session, customerId, {
    invoiceDate: '2026-01-01',
    dueDate: '2026-01-15',
  });
  await issueInvoice(session, overdue.id);

  // Draft and a void invoice.
  await createInvoice(session, customerId);
  const voided = await createInvoice(session, customerId);
  await issueInvoice(session, voided.id);
  await request(app)
    .post(`/api/v1/invoices/${voided.id}/void`)
    .set(authHeader(session))
    .send({ reason: 'Wrong customer' })
    .expect(200);
});

describe('GET /dashboard', () => {
  it('counts invoices by state without the void ones in the total', async () => {
    const response = await request(app)
      .get(`/api/v1/dashboard?${RANGE}`)
      .set(authHeader(session))
      .expect(200);

    expect(response.body.counts).toMatchObject({
      paid: 1,
      partial: 1,
      unpaid: 1,
      draft: 1,
      void: 1,
      overdue: 1,
      total: 3,
    });
  });

  it('adds revenue from issued invoices only', async () => {
    const response = await request(app)
      .get(`/api/v1/dashboard?${RANGE}`)
      .set(authHeader(session))
      .expect(200);

    expect(response.body.revenue).toMatchObject({
      billedMinor: TOTAL * 3,
      collectedMinor: TOTAL + 1_000_000,
      outstandingMinor: TOTAL * 2 - 1_000_000,
      overdueMinor: TOTAL,
    });
  });

  it('lists recent invoices and the overdue queue', async () => {
    const response = await request(app)
      .get(`/api/v1/dashboard?${RANGE}`)
      .set(authHeader(session))
      .expect(200);

    expect((response.body.recentInvoices as unknown[]).length).toBeGreaterThan(0);
    expect((response.body.overdueInvoices as Record<string, unknown>[]).length).toBe(1);
  });

  it('uses the current month when no range is given', async () => {
    const response = await request(app)
      .get('/api/v1/dashboard')
      .set(authHeader(session))
      .expect(200);

    expect(response.body.range.from).toMatch(/^\d{4}-\d{2}-01$/);
    expect(response.body.range.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('GET /reports/summary', () => {
  it('reports billed, collected, tax and average', async () => {
    const response = await request(app)
      .get(`/api/v1/reports/summary?${RANGE}`)
      .set(authHeader(session))
      .expect(200);

    expect(response.body.invoiceCount).toBe(3);
    expect(response.body.billedMinor).toBe(TOTAL * 3);
    expect(response.body.taxableValueMinor).toBe(3_070_000 * 3);
    expect(response.body.taxCollectedMinor).toBe(552_600 * 3);
    expect(response.body.paymentsReceivedMinor).toBe(TOTAL + 1_000_000);
    expect(response.body.averageInvoiceMinor).toBe(TOTAL);
  });

  it('returns zeros for an empty range', async () => {
    const response = await request(app)
      .get('/api/v1/reports/summary?from=2020-01-01&to=2020-12-31')
      .set(authHeader(session))
      .expect(200);

    expect(response.body.invoiceCount).toBe(0);
    expect(response.body.billedMinor).toBe(0);
    expect(response.body.averageInvoiceMinor).toBe(0);
  });
});

describe('GET /reports/revenue', () => {
  it('groups revenue by month', async () => {
    const response = await request(app)
      .get(`/api/v1/reports/revenue?${RANGE}&groupBy=month`)
      .set(authHeader(session))
      .expect(200);

    const points = response.body.points as { month: string; billedMinor: number }[];

    expect(points).toHaveLength(2);
    expect(points[0]?.month).toBe('2026-01');
    expect(points[0]?.billedMinor).toBe(TOTAL);
    expect(points[1]?.billedMinor).toBe(TOTAL * 2);
  });
});

describe('GET /reports/outstanding', () => {
  it('puts the oldest balance in the 60+ bucket', async () => {
    const response = await request(app)
      .get('/api/v1/reports/outstanding?asOf=2026-10-24')
      .set(authHeader(session))
      .expect(200);

    const buckets = response.body.buckets as { bucket: string; amountMinor: number }[];
    const over60 = buckets.find((bucket) => bucket.bucket === '60+');

    expect(over60?.amountMinor).toBe(TOTAL);
    expect(response.body.totalMinor).toBe(TOTAL * 2 - 1_000_000);
  });
});

describe('GET /reports/gst', () => {
  it('splits taxable value and tax by rate', async () => {
    const response = await request(app)
      .get(`/api/v1/reports/gst?${RANGE}`)
      .set(authHeader(session))
      .expect(200);

    const rows = response.body.rows as Record<string, number>[];

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      taxRateBp: 1800,
      taxableValueMinor: 3_070_000 * 3,
      cgstMinor: 828_900,
      sgstMinor: 828_900,
      igstMinor: 0,
      taxMinor: 1_657_800,
    });
  });
});

describe('GET /reports/top-customers', () => {
  it('ranks customers by billed value', async () => {
    const response = await request(app)
      .get(`/api/v1/reports/top-customers?${RANGE}&limit=5`)
      .set(authHeader(session))
      .expect(200);

    const rows = response.body.rows as Record<string, unknown>[];

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: 'Acme Traders',
      billedMinor: TOTAL * 3,
      invoiceCount: 3,
    });
  });
});

describe('report tenant isolation', () => {
  it('gives a new business zeroed reports', async () => {
    const other = await registerAccount({ businessName: 'Other Studio' });

    const dashboard = await request(app)
      .get(`/api/v1/dashboard?${RANGE}`)
      .set(authHeader(other))
      .expect(200);

    expect(dashboard.body.revenue.billedMinor).toBe(0);
    expect(dashboard.body.counts.total).toBe(0);
  });
});
