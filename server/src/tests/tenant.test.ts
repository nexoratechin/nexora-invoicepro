import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MembershipModel } from '../models/index.js';
import { app, authHeader, registerAccount, type TestSession } from './helpers/api.js';
import { clearDatabase, connectTestDb, disconnectTestDb } from './helpers/test-db.js';

let alice: TestSession;
let bob: TestSession;

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

beforeEach(async () => {
  await clearDatabase();
  alice = await registerAccount({ businessName: 'Alice Studio' });
  bob = await registerAccount({ businessName: 'Bob Studio' });
});

async function createCustomerFor(session: TestSession): Promise<string> {
  const response = await request(app)
    .post('/api/v1/customers')
    .set(authHeader(session))
    .send({ name: 'Private Customer' })
    .expect(201);

  return response.body.customer.id as string;
}

describe('tenant isolation', () => {
  it('does not list another business customers', async () => {
    await createCustomerFor(alice);

    const response = await request(app).get('/api/v1/customers').set(authHeader(bob)).expect(200);

    expect(response.body.total).toBe(0);
  });

  it('hides another business customer on read', async () => {
    const customerId = await createCustomerFor(alice);

    const response = await request(app)
      .get(`/api/v1/customers/${customerId}`)
      .set(authHeader(bob))
      .expect(404);

    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('refuses to update another business customer', async () => {
    const customerId = await createCustomerFor(alice);

    await request(app)
      .patch(`/api/v1/customers/${customerId}`)
      .set(authHeader(bob))
      .send({ name: 'Hijacked' })
      .expect(404);

    const check = await request(app)
      .get(`/api/v1/customers/${customerId}`)
      .set(authHeader(alice))
      .expect(200);

    expect(check.body.customer.name).toBe('Private Customer');
  });

  it('refuses to delete another business customer', async () => {
    const customerId = await createCustomerFor(alice);

    await request(app).delete(`/api/v1/customers/${customerId}`).set(authHeader(bob)).expect(404);

    await request(app).get(`/api/v1/customers/${customerId}`).set(authHeader(alice)).expect(200);
  });

  it('does not leak products across businesses', async () => {
    const created = await request(app)
      .post('/api/v1/products')
      .set(authHeader(alice))
      .send({ name: 'Alice Service', unitPriceMinor: 1000, taxRateBp: 1800 })
      .expect(201);

    await request(app)
      .get(`/api/v1/products/${String(created.body.product.id)}`)
      .set(authHeader(bob))
      .expect(404);

    const list = await request(app).get('/api/v1/products').set(authHeader(bob)).expect(200);

    expect(list.body.total).toBe(0);
  });

  it('allows the same SKU in two different businesses', async () => {
    await request(app)
      .post('/api/v1/products')
      .set(authHeader(alice))
      .send({ name: 'Alice Product', sku: 'SHARED-1', unitPriceMinor: 1000, taxRateBp: 1800 })
      .expect(201);

    await request(app)
      .post('/api/v1/products')
      .set(authHeader(bob))
      .send({ name: 'Bob Product', sku: 'SHARED-1', unitPriceMinor: 2000, taxRateBp: 1800 })
      .expect(201);
  });

  it('keeps settings separate', async () => {
    await request(app)
      .put('/api/v1/settings')
      .set(authHeader(alice))
      .send({ invoicePrefix: 'ALC' })
      .expect(200);

    const response = await request(app).get('/api/v1/settings').set(authHeader(bob)).expect(200);

    expect(response.body.settings.invoicePrefix).toBe('NXP');
  });

  it('refuses a token signed for a membership that was revoked', async () => {
    await MembershipModel.updateMany(
      { userId: bob.userId },
      { $set: { status: 'revoked' } },
    ).exec();

    const response = await request(app).get('/api/v1/customers').set(authHeader(bob)).expect(401);

    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('takes the role from the database, not the token', async () => {
    // The token still says owner. The membership row is downgraded after login,
    // and requireAuth must read the current role.
    await MembershipModel.updateOne({ userId: alice.userId }, { $set: { role: 'staff' } }).exec();

    const response = await request(app)
      .patch('/api/v1/business')
      .set(authHeader(alice))
      .send({ name: 'Renamed By Staff' })
      .expect(403);

    expect(response.body.error.code).toBe('FORBIDDEN_ROLE');
  });
});

describe('access tokens', () => {
  it('rejects a token whose signature does not match', async () => {
    const parts = alice.accessToken.split('.');
    const tampered = `${String(parts[0])}.${String(parts[1])}.${'a'.repeat(43)}`;

    await request(app)
      .get('/api/v1/customers')
      .set('Authorization', `Bearer ${tampered}`)
      .expect(401);
  });

  it('ignores a business id supplied in the request', async () => {
    await createCustomerFor(alice);

    const response = await request(app)
      .get('/api/v1/customers')
      .set(authHeader(alice))
      .set('X-Business-Id', bob.businessId)
      .query({ businessId: bob.businessId })
      .expect(400);

    // The query key is rejected outright; nothing reached the database.
    expect(response.body.error.code).toBe('VALIDATION_FAILED');

    const plain = await request(app)
      .get('/api/v1/customers')
      .set(authHeader(alice))
      .set('X-Business-Id', bob.businessId)
      .expect(200);

    expect(plain.body.total).toBe(1);
    expect(plain.body.items[0].name).toBe('Private Customer');
  });
});
