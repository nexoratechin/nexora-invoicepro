import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { app, authHeader, registerAccount, type TestSession } from './helpers/api.js';
import { clearDatabase, connectTestDb, disconnectTestDb } from './helpers/test-db.js';

let session: TestSession;

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

beforeEach(async () => {
  await clearDatabase();
  session = await registerAccount();
});

async function createCustomer(overrides: Record<string, unknown> = {}): Promise<string> {
  const response = await request(app)
    .post('/api/v1/customers')
    .set(authHeader(session))
    .send({
      name: 'Acme Traders',
      email: 'billing@acme.test',
      phone: '+919876543210',
      stateCode: '27',
      billingAddress: {
        line1: '12 Market Road',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
      },
      ...overrides,
    })
    .expect(201);

  return response.body.customer.id as string;
}

describe('POST /customers', () => {
  it('creates a customer with defaults filled in', async () => {
    const id = await createCustomer();

    const response = await request(app)
      .get(`/api/v1/customers/${id}`)
      .set(authHeader(session))
      .expect(200);

    expect(response.body.customer).toMatchObject({
      name: 'Acme Traders',
      email: 'billing@acme.test',
      status: 'active',
      notes: '',
    });
    expect(response.body.customer.billingAddress.city).toBe('Mumbai');
    expect(response.body.stats).toMatchObject({
      totalBilledMinor: 0,
      outstandingMinor: 0,
      invoiceCount: 0,
    });
  });

  it('rejects a bad GSTIN', async () => {
    const response = await request(app)
      .post('/api/v1/customers')
      .set(authHeader(session))
      .send({ name: 'Bad GST', gstin: 'not-a-gstin' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('rejects an unknown field', async () => {
    await request(app)
      .post('/api/v1/customers')
      .set(authHeader(session))
      .send({ name: 'Sneaky', businessId: 'abc' })
      .expect(400);
  });

  it('rejects a name that is too short', async () => {
    await request(app)
      .post('/api/v1/customers')
      .set(authHeader(session))
      .send({ name: 'A' })
      .expect(400);
  });
});

describe('GET /customers', () => {
  it('lists with pagination metadata', async () => {
    await createCustomer({ name: 'Alpha' });
    await createCustomer({ name: 'Beta' });
    await createCustomer({ name: 'Gamma' });

    const response = await request(app)
      .get('/api/v1/customers?page=1&pageSize=2')
      .set(authHeader(session))
      .expect(200);

    expect(response.body.items).toHaveLength(2);
    expect(response.body.total).toBe(3);
    expect(response.body.totalPages).toBe(2);
    expect(response.body.items[0].name).toBe('Alpha');
  });

  it('searches by name, email, phone and GSTIN', async () => {
    await createCustomer({
      name: 'Zenith Labs',
      email: 'accounts@zenith.test',
      gstin: '24AAAAA0000A1Z5',
    });
    await createCustomer({ name: 'Other Co', email: 'hello@other.test', phone: '+919999999999' });

    const byName = await request(app)
      .get('/api/v1/customers?q=zenith')
      .set(authHeader(session))
      .expect(200);
    expect(byName.body.total).toBe(1);

    const byGstin = await request(app)
      .get('/api/v1/customers?q=24AAAAA')
      .set(authHeader(session))
      .expect(200);
    expect(byGstin.body.total).toBe(1);

    const byPhone = await request(app)
      .get('/api/v1/customers?q=98765')
      .set(authHeader(session))
      .expect(200);
    expect(byPhone.body.total).toBe(1);
  });

  it('filters archived customers', async () => {
    const id = await createCustomer({ name: 'Archived Co' });

    await request(app).post(`/api/v1/customers/${id}/archive`).set(authHeader(session)).expect(200);

    const active = await request(app)
      .get('/api/v1/customers?status=active')
      .set(authHeader(session))
      .expect(200);
    expect(active.body.total).toBe(0);

    const archived = await request(app)
      .get('/api/v1/customers?status=archived')
      .set(authHeader(session))
      .expect(200);
    expect(archived.body.total).toBe(1);
  });

  it('rejects an unknown query parameter instead of ignoring it', async () => {
    await request(app).get('/api/v1/customers?bogus=1').set(authHeader(session)).expect(400);
  });
});

describe('PATCH /customers/:id', () => {
  it('updates only the supplied fields', async () => {
    const id = await createCustomer();

    const response = await request(app)
      .patch(`/api/v1/customers/${id}`)
      .set(authHeader(session))
      .send({ phone: '+919000000000' })
      .expect(200);

    expect(response.body.customer.phone).toBe('+919000000000');
    expect(response.body.customer.name).toBe('Acme Traders');
  });

  it('returns 404 for an unknown id', async () => {
    await request(app)
      .patch('/api/v1/customers/64b7f8f8f8f8f8f8f8f8f8f8')
      .set(authHeader(session))
      .send({ name: 'Ghost' })
      .expect(404);
  });

  it('rejects a malformed id', async () => {
    await request(app)
      .patch('/api/v1/customers/not-an-id')
      .set(authHeader(session))
      .send({ name: 'Ghost' })
      .expect(400);
  });
});

describe('DELETE /customers/:id', () => {
  it('deletes a customer with no invoices', async () => {
    const id = await createCustomer();

    await request(app).delete(`/api/v1/customers/${id}`).set(authHeader(session)).expect(204);

    await request(app).get(`/api/v1/customers/${id}`).set(authHeader(session)).expect(404);
  });
});
