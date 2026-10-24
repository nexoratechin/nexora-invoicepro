import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  app,
  authHeader,
  createCustomer,
  createInvoice,
  createProduct,
  issueInvoice,
  registerAccount,
  type TestSession,
} from './helpers/api.js';
import { clearDatabase, connectTestDb, disconnectTestDb } from './helpers/test-db.js';

let session: TestSession;
let customerId: string;

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

beforeEach(async () => {
  await clearDatabase();
  session = await registerAccount({ stateCode: '24' });
  customerId = await createCustomer(session, { stateCode: '24' });
});

describe('POST /invoices', () => {
  it('creates a draft with server computed totals', async () => {
    const { body } = await createInvoice(session, customerId);

    expect(body.status).toBe('draft');
    expect(body.invoiceNumber).toBeNull();
    expect(body.paymentState).toBe('unpaid');

    const totals = body.totals as Record<string, number>;
    expect(totals.subtotalMinor).toBe(3_100_000);
    expect(totals.discountTotalMinor).toBe(30_000);
    expect(totals.taxableTotalMinor).toBe(3_070_000);
    expect(totals.taxTotalMinor).toBe(552_600);
    expect(totals.totalMinor).toBe(3_622_600);
    expect(totals.cgstTotalMinor).toBe(276_300);
    expect(totals.sgstTotalMinor).toBe(276_300);
    expect(totals.igstTotalMinor).toBe(0);
    expect(body.balanceDueMinor).toBe(3_622_600);
    expect(body.amountPaidMinor).toBe(0);
  });

  it('computes each line, including the discount before tax', async () => {
    const { body } = await createInvoice(session, customerId);
    const lines = body.lineItems as Record<string, number>[];

    expect(lines[0]).toMatchObject({
      grossMinor: 2_500_000,
      taxableMinor: 2_500_000,
      taxMinor: 450_000,
      lineTotalMinor: 2_950_000,
    });
    expect(lines[1]).toMatchObject({
      grossMinor: 600_000,
      discountMinor: 30_000,
      taxableMinor: 570_000,
      taxMinor: 102_600,
      lineTotalMinor: 672_600,
    });
  });

  it('rejects a client supplied total instead of trusting it', async () => {
    const response = await request(app)
      .post('/api/v1/invoices')
      .set(authHeader(session))
      .send({
        customerId,
        invoiceDate: '2026-10-24',
        dueDate: '2026-11-08',
        lineItems: [
          { description: 'Thing', quantityMilli: 1000, unitPriceMinor: 100, taxRateBp: 1800 },
        ],
        totals: { totalMinor: 1 },
        status: 'issued',
        invoiceNumber: 'FAKE-1',
      })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('uses IGST when the place of supply is another state', async () => {
    const { body } = await createInvoice(session, customerId, {
      placeOfSupplyStateCode: '27',
    });

    const totals = body.totals as Record<string, number>;
    expect(body.taxTreatment).toBe('inter');
    expect(totals.igstTotalMinor).toBe(552_600);
    expect(totals.cgstTotalMinor).toBe(0);
    expect(totals.sgstTotalMinor).toBe(0);
  });

  it('rejects a due date before the invoice date', async () => {
    const response = await request(app)
      .post('/api/v1/invoices')
      .set(authHeader(session))
      .send({
        customerId,
        invoiceDate: '2026-10-24',
        dueDate: '2026-10-01',
        lineItems: [
          { description: 'Thing', quantityMilli: 1000, unitPriceMinor: 100, taxRateBp: 1800 },
        ],
      })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('rejects an inactive product', async () => {
    const productId = await createProduct(session, { name: 'Retired' });
    await request(app)
      .post(`/api/v1/products/${productId}/status`)
      .set(authHeader(session))
      .send({ isActive: false })
      .expect(200);

    const response = await request(app)
      .post('/api/v1/invoices')
      .set(authHeader(session))
      .send({
        customerId,
        invoiceDate: '2026-10-24',
        dueDate: '2026-11-08',
        lineItems: [
          {
            productId,
            description: 'Retired service',
            quantityMilli: 1000,
            unitPriceMinor: 1000,
            taxRateBp: 1800,
          },
        ],
      })
      .expect(400);

    expect(response.body.error.code).toBe('PRODUCT_INACTIVE');
  });

  it('copies product details into the line at creation time', async () => {
    const productId = await createProduct(session, { name: 'Original name' });

    const { id } = await createInvoice(session, customerId, {
      lineItems: [
        {
          productId,
          description: 'Original name',
          quantityMilli: 1000,
          unitPriceMinor: 2_500_000,
          taxRateBp: 1800,
        },
      ],
    });

    await request(app)
      .patch(`/api/v1/products/${productId}`)
      .set(authHeader(session))
      .send({ name: 'Renamed product', unitPriceMinor: 9_999_999 })
      .expect(200);

    const response = await request(app)
      .get(`/api/v1/invoices/${id}`)
      .set(authHeader(session))
      .expect(200);

    const line = (response.body.invoice.lineItems as Record<string, unknown>[])[0];
    expect(line?.description).toBe('Original name');
    expect(line?.unitPriceMinor).toBe(2_500_000);
  });
});

describe('POST /invoices/:id/issue', () => {
  it('assigns a fiscal year number and freezes a snapshot', async () => {
    const { id } = await createInvoice(session, customerId);
    const issued = await issueInvoice(session, id);

    expect(issued.status).toBe('issued');
    expect(issued.invoiceNumber).toMatch(/^NXP\/\d{4}-\d{2}\/0001$/);
    expect(issued.issuedAt).toBeTypeOf('string');

    const snapshot = issued.customerSnapshot as Record<string, unknown>;
    expect(snapshot.name).toBe('Acme Traders');

    const businessSnapshot = issued.businessSnapshot as Record<string, unknown>;
    expect(businessSnapshot.name).toBe('Test Studio');
  });

  it('refuses to issue the same invoice twice', async () => {
    const { id } = await createInvoice(session, customerId);
    await issueInvoice(session, id);

    const response = await request(app)
      .post(`/api/v1/invoices/${id}/issue`)
      .set(authHeader(session))
      .expect(409);

    expect(response.body.error.code).toBe('INVOICE_ALREADY_ISSUED');
  });

  it('renumbers from 1 for each business', async () => {
    const other = await registerAccount({ businessName: 'Other Studio' });
    const otherCustomer = await createCustomer(other, { stateCode: '24' });

    const mine = await createInvoice(session, customerId);
    const theirs = await createInvoice(other, otherCustomer);

    const myIssued = await issueInvoice(session, mine.id);
    const theirIssued = await issueInvoice(other, theirs.id);

    expect(myIssued.invoiceNumber).toMatch(/\/0001$/);
    expect(theirIssued.invoiceNumber).toMatch(/\/0001$/);
  });

  it('gives 20 concurrent issues 20 unique sequential numbers', async () => {
    const drafts = await Promise.all(
      Array.from({ length: 20 }, () => createInvoice(session, customerId)),
    );

    const responses = await Promise.all(
      drafts.map((draft) =>
        request(app).post(`/api/v1/invoices/${draft.id}/issue`).set(authHeader(session)),
      ),
    );

    for (const response of responses) {
      expect(response.status).toBe(200);
    }

    const numbers = responses.map((response) => String(response.body.invoice.invoiceNumber));
    expect(new Set(numbers).size).toBe(20);

    const sequences = numbers.map((number) => Number(number.split('/')[2])).sort((a, b) => a - b);
    expect(sequences).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
  });
});

describe('PATCH /invoices/:id', () => {
  it('recalculates when a line changes', async () => {
    const { id } = await createInvoice(session, customerId, {
      lineItems: [
        { description: 'Fixed', quantityMilli: 1000, unitPriceMinor: 100_000, taxRateBp: 1800 },
      ],
    });

    const response = await request(app)
      .patch(`/api/v1/invoices/${id}`)
      .set(authHeader(session))
      .send({
        lineItems: [
          { description: 'Fixed', quantityMilli: 3000, unitPriceMinor: 100_000, taxRateBp: 1800 },
        ],
      })
      .expect(200);

    const totals = response.body.invoice.totals as Record<string, number>;
    expect(totals.taxableTotalMinor).toBe(300_000);
    expect(totals.totalMinor).toBe(354_000);
    expect(response.body.invoice.balanceDueMinor).toBe(354_000);
  });

  it('refuses to edit an issued invoice', async () => {
    const { id } = await createInvoice(session, customerId);
    await issueInvoice(session, id);

    const response = await request(app)
      .patch(`/api/v1/invoices/${id}`)
      .set(authHeader(session))
      .send({ notes: 'Too late' })
      .expect(409);

    expect(response.body.error.code).toBe('INVOICE_NOT_DRAFT');
  });
});

describe('DELETE /invoices/:id', () => {
  it('deletes a draft', async () => {
    const { id } = await createInvoice(session, customerId);

    await request(app).delete(`/api/v1/invoices/${id}`).set(authHeader(session)).expect(204);
  });

  it('refuses to delete an issued invoice', async () => {
    const { id } = await createInvoice(session, customerId);
    await issueInvoice(session, id);

    const response = await request(app)
      .delete(`/api/v1/invoices/${id}`)
      .set(authHeader(session))
      .expect(409);

    expect(response.body.error.code).toBe('CONFLICT');
  });
});

describe('POST /invoices/:id/void', () => {
  it('voids an issued invoice with a reason', async () => {
    const { id } = await createInvoice(session, customerId);
    await issueInvoice(session, id);

    const response = await request(app)
      .post(`/api/v1/invoices/${id}/void`)
      .set(authHeader(session))
      .send({ reason: 'Raised against the wrong customer' })
      .expect(200);

    expect(response.body.invoice.status).toBe('void');
    expect(response.body.invoice.voidReason).toBe('Raised against the wrong customer');
  });

  it('requires a reason of at least three characters', async () => {
    const { id } = await createInvoice(session, customerId);
    await issueInvoice(session, id);

    await request(app)
      .post(`/api/v1/invoices/${id}/void`)
      .set(authHeader(session))
      .send({ reason: 'x' })
      .expect(400);
  });

  it('keeps the void invoice out of revenue but in the list', async () => {
    const { id } = await createInvoice(session, customerId);
    await issueInvoice(session, id);
    await request(app)
      .post(`/api/v1/invoices/${id}/void`)
      .set(authHeader(session))
      .send({ reason: 'Duplicate of another invoice' })
      .expect(200);

    const list = await request(app)
      .get('/api/v1/invoices?status=void')
      .set(authHeader(session))
      .expect(200);

    expect(list.body.total).toBe(1);

    const dashboard = await request(app)
      .get('/api/v1/dashboard')
      .set(authHeader(session))
      .expect(200);

    expect(dashboard.body.revenue.billedMinor).toBe(0);
    expect(dashboard.body.counts.void).toBe(1);
  });
});

describe('POST /invoices/:id/duplicate', () => {
  it('copies an issued invoice into a new draft', async () => {
    const { id } = await createInvoice(session, customerId);
    const issued = await issueInvoice(session, id);

    const response = await request(app)
      .post(`/api/v1/invoices/${id}/duplicate`)
      .set(authHeader(session))
      .expect(201);

    expect(response.body.invoice.status).toBe('draft');
    expect(response.body.invoice.invoiceNumber).toBeNull();
    expect(response.body.invoice.totals.totalMinor).toBe(
      (issued.totals as Record<string, number>).totalMinor,
    );
    expect(response.body.invoice.amountPaidMinor).toBe(0);
  });
});

describe('GET /invoices', () => {
  it('filters by status and payment state', async () => {
    const { id } = await createInvoice(session, customerId);
    await createInvoice(session, customerId);
    await issueInvoice(session, id);

    const issued = await request(app)
      .get('/api/v1/invoices?status=issued')
      .set(authHeader(session))
      .expect(200);
    expect(issued.body.total).toBe(1);

    const drafts = await request(app)
      .get('/api/v1/invoices?status=draft')
      .set(authHeader(session))
      .expect(200);
    expect(drafts.body.total).toBe(1);
  });

  it('finds an invoice by number and by customer name', async () => {
    const { id } = await createInvoice(session, customerId);
    const issued = await issueInvoice(session, id);
    const number = String(issued.invoiceNumber);

    const byNumber = await request(app)
      .get(`/api/v1/invoices?q=${encodeURIComponent(number)}`)
      .set(authHeader(session))
      .expect(200);
    expect(byNumber.body.total).toBe(1);

    const byName = await request(app)
      .get('/api/v1/invoices?q=acme')
      .set(authHeader(session))
      .expect(200);
    expect(byName.body.total).toBe(1);
  });

  it('marks an unpaid invoice past its due date as overdue', async () => {
    const { id } = await createInvoice(session, customerId, {
      invoiceDate: '2026-01-01',
      dueDate: '2026-01-15',
    });
    await issueInvoice(session, id);

    const response = await request(app)
      .get('/api/v1/invoices?overdue=true')
      .set(authHeader(session))
      .expect(200);

    expect(response.body.total).toBe(1);
    expect(response.body.items[0].overdue).toBe(true);
  });
});

describe('invoice tenant isolation', () => {
  it('cannot create an invoice for another business customer', async () => {
    const other = await registerAccount({ businessName: 'Other Studio' });

    const response = await request(app)
      .post('/api/v1/invoices')
      .set(authHeader(other))
      .send({
        customerId,
        invoiceDate: '2026-10-24',
        dueDate: '2026-11-08',
        lineItems: [
          { description: 'Thing', quantityMilli: 1000, unitPriceMinor: 100, taxRateBp: 1800 },
        ],
      })
      .expect(404);

    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('cannot read, edit, issue or void another business invoice', async () => {
    const { id } = await createInvoice(session, customerId);
    const other = await registerAccount({ businessName: 'Other Studio' });

    await request(app).get(`/api/v1/invoices/${id}`).set(authHeader(other)).expect(404);
    await request(app)
      .patch(`/api/v1/invoices/${id}`)
      .set(authHeader(other))
      .send({ notes: 'Hijack' })
      .expect(404);
    await request(app).post(`/api/v1/invoices/${id}/issue`).set(authHeader(other)).expect(404);
    await request(app)
      .post(`/api/v1/invoices/${id}/void`)
      .set(authHeader(other))
      .send({ reason: 'Hijack attempt' })
      .expect(404);
  });
});
