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

async function createProduct(overrides: Record<string, unknown> = {}): Promise<string> {
  const response = await request(app)
    .post('/api/v1/products')
    .set(authHeader(session))
    .send({
      name: 'Website redesign',
      description: 'Five page marketing site',
      unitLabel: 'project',
      unitPriceMinor: 2_500_000,
      taxRateBp: 1800,
      ...overrides,
    })
    .expect(201);

  return response.body.product.id as string;
}

describe('POST /products', () => {
  it('creates a product', async () => {
    const id = await createProduct({ sku: 'WEB-001' });

    const response = await request(app)
      .get(`/api/v1/products/${id}`)
      .set(authHeader(session))
      .expect(200);

    expect(response.body.product).toMatchObject({
      name: 'Website redesign',
      sku: 'WEB-001',
      unitPriceMinor: 2_500_000,
      taxRateBp: 1800,
      isActive: true,
    });
  });

  it('rejects a tax rate that is not a GST slab', async () => {
    const response = await request(app)
      .post('/api/v1/products')
      .set(authHeader(session))
      .send({ name: 'Odd rate', unitPriceMinor: 1000, taxRateBp: 1700 })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('rejects a negative price', async () => {
    await request(app)
      .post('/api/v1/products')
      .set(authHeader(session))
      .send({ name: 'Negative', unitPriceMinor: -5, taxRateBp: 1800 })
      .expect(400);
  });

  it('keeps SKUs unique within a business', async () => {
    await createProduct({ sku: 'DUP-1' });

    const response = await request(app)
      .post('/api/v1/products')
      .set(authHeader(session))
      .send({ name: 'Another', sku: 'DUP-1', unitPriceMinor: 100, taxRateBp: 1800 })
      .expect(409);

    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('allows several products with no SKU', async () => {
    await createProduct({ name: 'No SKU one' });
    await createProduct({ name: 'No SKU two' });

    const response = await request(app)
      .get('/api/v1/products')
      .set(authHeader(session))
      .expect(200);

    expect(response.body.total).toBe(2);
  });
});

describe('GET /products', () => {
  it('filters by active state', async () => {
    const id = await createProduct({ name: 'Retired service' });

    await request(app)
      .post(`/api/v1/products/${id}/status`)
      .set(authHeader(session))
      .send({ isActive: false })
      .expect(200);

    const active = await request(app)
      .get('/api/v1/products?isActive=true')
      .set(authHeader(session))
      .expect(200);
    expect(active.body.total).toBe(0);

    const inactive = await request(app)
      .get('/api/v1/products?isActive=false')
      .set(authHeader(session))
      .expect(200);
    expect(inactive.body.total).toBe(1);
  });

  it('searches by name and SKU', async () => {
    await createProduct({ name: 'Retainer', sku: 'RET-9' });
    await createProduct({ name: 'Hosting', sku: 'HOST-1' });

    const response = await request(app)
      .get('/api/v1/products?q=ret')
      .set(authHeader(session))
      .expect(200);

    expect(response.body.total).toBe(1);
    expect(response.body.items[0].sku).toBe('RET-9');
  });
});

describe('PATCH /products/:id', () => {
  it('updates the price and tax rate', async () => {
    const id = await createProduct();

    const response = await request(app)
      .patch(`/api/v1/products/${id}`)
      .set(authHeader(session))
      .send({ unitPriceMinor: 3_000_000, taxRateBp: 1200 })
      .expect(200);

    expect(response.body.product.unitPriceMinor).toBe(3_000_000);
    expect(response.body.product.taxRateBp).toBe(1200);
  });

  it('clears a SKU when sent as an empty string', async () => {
    const id = await createProduct({ sku: 'TEMP-1' });

    const response = await request(app)
      .patch(`/api/v1/products/${id}`)
      .set(authHeader(session))
      .send({ sku: '' })
      .expect(200);

    expect(response.body.product.sku).toBeNull();
  });
});

describe('DELETE /products/:id', () => {
  it('deletes an unused product', async () => {
    const id = await createProduct();

    await request(app).delete(`/api/v1/products/${id}`).set(authHeader(session)).expect(204);
  });
});
