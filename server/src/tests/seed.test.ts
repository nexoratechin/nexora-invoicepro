import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { InvoiceModel, PaymentModel, UserModel } from '../models/index.js';
import { DEMO_EMAIL, DEMO_PASSWORD, seedDemoData } from '../scripts/seed.js';
import { app } from './helpers/api.js';
import { clearDatabase, connectTestDb, disconnectTestDb } from './helpers/test-db.js';

beforeAll(async () => {
  await connectTestDb();
  await clearDatabase();
});

afterAll(async () => {
  await disconnectTestDb();
});

describe('seed script', () => {
  it('creates a consistent demo dataset through the services', async () => {
    const result = await seedDemoData();

    expect(result).toMatchObject({
      customers: 6,
      products: 8,
      invoices: 12,
      voided: 1,
      paid: 2,
      partial: 2,
      drafts: 1,
    });
    expect(result.issued).toBe(10);
    expect(result.overdue).toBeGreaterThanOrEqual(3);

    const voided = await InvoiceModel.countDocuments({
      businessId: result.businessId,
      status: 'void',
    }).exec();
    expect(voided).toBe(1);

    const paidInvoice = await InvoiceModel.findOne({
      businessId: result.businessId,
      paymentState: 'paid',
      status: 'issued',
    }).exec();
    expect(paidInvoice?.balanceDueMinor).toBe(0);

    const totalPaid = await PaymentModel.aggregate<{ total: number }>([
      { $match: { businessId: paidInvoice?.businessId, status: 'active' } },
      { $group: { _id: null, total: { $sum: '$amountMinor' } } },
    ]);
    expect(totalPaid[0]?.total ?? 0).toBeGreaterThan(0);

    const user = await UserModel.countDocuments({ email: DEMO_EMAIL }).exec();
    expect(user).toBe(1);
  });

  it('can sign in as the demo owner and read a populated dashboard', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Client-Platform', 'mobile')
      .send({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
      .expect(200);

    const token = String(login.body.accessToken);

    const dashboard = await request(app)
      .get('/api/v1/dashboard?from=2020-01-01&to=2030-12-31')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(dashboard.body.counts.total).toBe(10);
    expect(dashboard.body.counts.void).toBe(1);
    expect(dashboard.body.counts.draft).toBe(1);
    expect(dashboard.body.revenue.billedMinor).toBeGreaterThan(0);
    expect(dashboard.body.revenue.collectedMinor).toBeGreaterThan(0);
  });

  it('reports a GST split for the seeded invoices', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Client-Platform', 'mobile')
      .send({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
      .expect(200);

    const gst = await request(app)
      .get('/api/v1/reports/gst?from=2020-01-01&to=2030-12-31')
      .set('Authorization', `Bearer ${String(login.body.accessToken)}`)
      .expect(200);

    const rates = (gst.body.rows as { taxRateBp: number }[]).map((row) => row.taxRateBp);

    expect(rates).toEqual([0, 500, 1200, 1800]);
    expect(gst.body.totals.taxMinor).toBeGreaterThan(0);
  });
});
