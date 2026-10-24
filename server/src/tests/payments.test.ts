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

let session: TestSession;
let customerId: string;
let invoiceId: string;

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
  const invoice = await createInvoice(session, customerId);
  invoiceId = invoice.id;
  await issueInvoice(session, invoiceId);
});

async function readInvoice(): Promise<Record<string, unknown>> {
  const response = await request(app)
    .get(`/api/v1/invoices/${invoiceId}`)
    .set(authHeader(session))
    .expect(200);

  return response.body.invoice as Record<string, unknown>;
}

describe('POST /invoices/:id/payments', () => {
  it('records a partial payment and moves the invoice to partial', async () => {
    const result = await recordPayment(session, invoiceId, { amountMinor: 1_000_000 });

    expect(result.status).toBe(201);

    const invoice = await readInvoice();
    expect(invoice.paymentState).toBe('partial');
    expect(invoice.amountPaidMinor).toBe(1_000_000);
    expect(invoice.balanceDueMinor).toBe(TOTAL - 1_000_000);
  });

  it('moves to paid when the balance is cleared', async () => {
    await recordPayment(session, invoiceId, { amountMinor: 1_000_000 });
    await recordPayment(session, invoiceId, { amountMinor: TOTAL - 1_000_000 });

    const invoice = await readInvoice();
    expect(invoice.paymentState).toBe('paid');
    expect(invoice.balanceDueMinor).toBe(0);
    expect(invoice.amountPaidMinor).toBe(TOTAL);
  });

  it('refuses a payment above the outstanding balance', async () => {
    const response = await request(app)
      .post(`/api/v1/invoices/${invoiceId}/payments`)
      .set(authHeader(session))
      .set('Idempotency-Key', 'overpay-key-1234')
      .send({ amountMinor: TOTAL + 1, paidAt: '2026-10-24', method: 'cash' })
      .expect(409);

    expect(response.body.error.code).toBe('INSUFFICIENT_BALANCE');
    expect(response.body.error.details.balanceDueMinor).toBe(TOTAL);

    const invoice = await readInvoice();
    expect(invoice.amountPaidMinor).toBe(0);
  });

  it('requires an idempotency key', async () => {
    const response = await request(app)
      .post(`/api/v1/invoices/${invoiceId}/payments`)
      .set(authHeader(session))
      .send({ amountMinor: 1000, paidAt: '2026-10-24', method: 'cash' })
      .expect(400);

    expect(response.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('returns the same payment for a repeated key and charges once', async () => {
    const key = 'retry-safe-key-0001';

    const first = await recordPayment(session, invoiceId, { amountMinor: 500_000 }, key);
    const second = await recordPayment(session, invoiceId, { amountMinor: 500_000 }, key);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect((second.body.payment as Record<string, unknown>).id).toBe(
      (first.body.payment as Record<string, unknown>).id,
    );

    const invoice = await readInvoice();
    expect(invoice.amountPaidMinor).toBe(500_000);
    expect(invoice.balanceDueMinor).toBe(TOTAL - 500_000);
  });

  it('charges once when two requests with the same key arrive together', async () => {
    const key = 'parallel-key-0001';

    const responses = await Promise.all([
      request(app)
        .post(`/api/v1/invoices/${invoiceId}/payments`)
        .set(authHeader(session))
        .set('Idempotency-Key', key)
        .send({ amountMinor: 400_000, paidAt: '2026-10-24', method: 'upi' }),
      request(app)
        .post(`/api/v1/invoices/${invoiceId}/payments`)
        .set(authHeader(session))
        .set('Idempotency-Key', key)
        .send({ amountMinor: 400_000, paidAt: '2026-10-24', method: 'upi' }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 201]);

    const invoice = await readInvoice();
    expect(invoice.amountPaidMinor).toBe(400_000);
  });

  it('refuses a payment on a draft invoice', async () => {
    const draft = await createInvoice(session, customerId);

    const response = await request(app)
      .post(`/api/v1/invoices/${draft.id}/payments`)
      .set(authHeader(session))
      .set('Idempotency-Key', 'draft-key-0001')
      .send({ amountMinor: 1000, paidAt: '2026-10-24', method: 'cash' })
      .expect(409);

    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('refuses a payment from another business', async () => {
    const other = await registerAccount({ businessName: 'Other Studio' });

    await request(app)
      .post(`/api/v1/invoices/${invoiceId}/payments`)
      .set(authHeader(other))
      .set('Idempotency-Key', 'cross-tenant-0001')
      .send({ amountMinor: 1000, paidAt: '2026-10-24', method: 'cash' })
      .expect(404);
  });

  it('rejects an unknown payment method', async () => {
    await request(app)
      .post(`/api/v1/invoices/${invoiceId}/payments`)
      .set(authHeader(session))
      .set('Idempotency-Key', 'bad-method-0001')
      .send({ amountMinor: 1000, paidAt: '2026-10-24', method: 'barter' })
      .expect(400);
  });
});

describe('POST /payments/:id/void', () => {
  it('restores the balance and the payment state', async () => {
    const recorded = await recordPayment(session, invoiceId, { amountMinor: 1_000_000 });
    const paymentId = (recorded.body.payment as Record<string, unknown>).id as string;

    await request(app)
      .post(`/api/v1/payments/${paymentId}/void`)
      .set(authHeader(session))
      .send({ reason: 'Recorded against the wrong invoice' })
      .expect(200);

    const invoice = await readInvoice();
    expect(invoice.amountPaidMinor).toBe(0);
    expect(invoice.balanceDueMinor).toBe(TOTAL);
    expect(invoice.paymentState).toBe('unpaid');
  });

  it('allows the balance to be paid again after a void', async () => {
    const recorded = await recordPayment(session, invoiceId, { amountMinor: 1_000_000 });
    const paymentId = (recorded.body.payment as Record<string, unknown>).id as string;

    await request(app)
      .post(`/api/v1/payments/${paymentId}/void`)
      .set(authHeader(session))
      .send({ reason: 'Cheque bounced' })
      .expect(200);

    await recordPayment(session, invoiceId, { amountMinor: TOTAL });

    const invoice = await readInvoice();
    expect(invoice.paymentState).toBe('paid');
  });

  it('refuses to void the same payment twice', async () => {
    const recorded = await recordPayment(session, invoiceId, { amountMinor: 1_000_000 });
    const paymentId = (recorded.body.payment as Record<string, unknown>).id as string;

    await request(app)
      .post(`/api/v1/payments/${paymentId}/void`)
      .set(authHeader(session))
      .send({ reason: 'First void' })
      .expect(200);

    const response = await request(app)
      .post(`/api/v1/payments/${paymentId}/void`)
      .set(authHeader(session))
      .send({ reason: 'Second void' })
      .expect(409);

    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('blocks voiding an invoice that still has an active payment', async () => {
    await recordPayment(session, invoiceId, { amountMinor: 100_000 });

    const response = await request(app)
      .post(`/api/v1/invoices/${invoiceId}/void`)
      .set(authHeader(session))
      .send({ reason: 'Wanted to cancel' })
      .expect(409);

    expect(response.body.error.code).toBe('INVOICE_HAS_PAYMENTS');
  });
});

describe('GET /payments', () => {
  it('lists payments with the invoice number', async () => {
    await recordPayment(session, invoiceId, { method: 'upi' });

    const response = await request(app)
      .get('/api/v1/payments')
      .set(authHeader(session))
      .expect(200);

    expect(response.body.total).toBe(1);
    expect(response.body.items[0].method).toBe('upi');
  });

  it('filters by method', async () => {
    await recordPayment(session, invoiceId, { method: 'cash' });
    await recordPayment(session, invoiceId, { method: 'upi' });

    const response = await request(app)
      .get('/api/v1/payments?method=cash')
      .set(authHeader(session))
      .expect(200);

    expect(response.body.total).toBe(1);
  });

  it('does not show another business payments', async () => {
    await recordPayment(session, invoiceId, { method: 'cash' });
    const other = await registerAccount({ businessName: 'Other Studio' });

    const response = await request(app).get('/api/v1/payments').set(authHeader(other)).expect(200);

    expect(response.body.total).toBe(0);
  });
});
