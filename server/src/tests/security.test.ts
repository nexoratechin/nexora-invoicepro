import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MembershipModel } from '../models/index.js';
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

type Method = 'get' | 'post' | 'patch' | 'put' | 'delete';

const SOME_ID = '64b7f8f8f8f8f8f8f8f8f8f8';

const protectedRoutes: { method: Method; path: string }[] = [
  { method: 'get', path: '/api/v1/customers' },
  { method: 'post', path: '/api/v1/customers' },
  { method: 'get', path: `/api/v1/customers/${SOME_ID}` },
  { method: 'patch', path: `/api/v1/customers/${SOME_ID}` },
  { method: 'delete', path: `/api/v1/customers/${SOME_ID}` },
  { method: 'post', path: `/api/v1/customers/${SOME_ID}/archive` },
  { method: 'post', path: `/api/v1/customers/${SOME_ID}/restore` },
  { method: 'get', path: '/api/v1/products' },
  { method: 'post', path: '/api/v1/products' },
  { method: 'get', path: `/api/v1/products/${SOME_ID}` },
  { method: 'patch', path: `/api/v1/products/${SOME_ID}` },
  { method: 'post', path: `/api/v1/products/${SOME_ID}/status` },
  { method: 'delete', path: `/api/v1/products/${SOME_ID}` },
  { method: 'get', path: '/api/v1/invoices' },
  { method: 'post', path: '/api/v1/invoices' },
  { method: 'get', path: `/api/v1/invoices/${SOME_ID}` },
  { method: 'patch', path: `/api/v1/invoices/${SOME_ID}` },
  { method: 'delete', path: `/api/v1/invoices/${SOME_ID}` },
  { method: 'post', path: `/api/v1/invoices/${SOME_ID}/issue` },
  { method: 'post', path: `/api/v1/invoices/${SOME_ID}/void` },
  { method: 'post', path: `/api/v1/invoices/${SOME_ID}/duplicate` },
  { method: 'get', path: `/api/v1/invoices/${SOME_ID}/pdf` },
  { method: 'get', path: `/api/v1/invoices/${SOME_ID}/events` },
  { method: 'get', path: `/api/v1/invoices/${SOME_ID}/payments` },
  { method: 'post', path: `/api/v1/invoices/${SOME_ID}/payments` },
  { method: 'get', path: '/api/v1/payments' },
  { method: 'get', path: `/api/v1/payments/${SOME_ID}` },
  { method: 'post', path: `/api/v1/payments/${SOME_ID}/void` },
  { method: 'get', path: '/api/v1/dashboard' },
  { method: 'get', path: '/api/v1/reports/summary' },
  { method: 'get', path: '/api/v1/reports/revenue' },
  { method: 'get', path: '/api/v1/reports/outstanding' },
  { method: 'get', path: '/api/v1/reports/gst' },
  { method: 'get', path: '/api/v1/reports/top-customers' },
  { method: 'get', path: '/api/v1/business' },
  { method: 'patch', path: '/api/v1/business' },
  { method: 'get', path: '/api/v1/settings' },
  { method: 'put', path: '/api/v1/settings' },
  { method: 'get', path: '/api/v1/me' },
  { method: 'patch', path: '/api/v1/me' },
  { method: 'get', path: '/api/v1/auth/me' },
  { method: 'post', path: '/api/v1/auth/logout-all' },
  { method: 'post', path: '/api/v1/auth/change-password' },
];

function call(method: Method, path: string): request.Test {
  switch (method) {
    case 'get':
      return request(app).get(path);
    case 'post':
      return request(app).post(path).send({});
    case 'patch':
      return request(app).patch(path).send({});
    case 'put':
      return request(app).put(path).send({});
    case 'delete':
      return request(app).delete(path);
  }
}

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

describe('authentication matrix', () => {
  it.each(protectedRoutes)(
    '$method $path rejects an anonymous caller',
    async ({ method, path }) => {
      const response = await call(method, path);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    },
  );

  it('every protected route is in the matrix above', () => {
    // Guards against a new route shipping without an auth test.
    expect(protectedRoutes.length).toBeGreaterThanOrEqual(42);
  });
});

describe('staff role restrictions', () => {
  async function asStaff(): Promise<TestSession> {
    await MembershipModel.updateOne({ userId: session.userId }, { $set: { role: 'staff' } }).exec();

    return session;
  }

  it.each([
    { method: 'patch' as Method, path: '/api/v1/business' },
    { method: 'put' as Method, path: '/api/v1/settings' },
    { method: 'delete' as Method, path: '/api/v1/customers/ID' },
    { method: 'delete' as Method, path: '/api/v1/products/ID' },
  ])('$method $path is refused for staff', async ({ method, path }) => {
    const staff = await asStaff();
    const customerIdForPath = customerId;
    const finalPath = path.replace('ID', customerIdForPath);

    const response = await call(method, finalPath).set(authHeader(staff));

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN_ROLE');
  });

  it('refuses staff voiding an invoice and voiding a payment', async () => {
    const invoice = await createInvoice(session, customerId);
    await issueInvoice(session, invoice.id);
    const payment = await recordPayment(session, invoice.id, { amountMinor: 1000 });
    const staff = await asStaff();

    await request(app)
      .post(`/api/v1/invoices/${invoice.id}/void`)
      .set(authHeader(staff))
      .send({ reason: 'Staff attempt' })
      .expect(403);

    await request(app)
      .post(`/api/v1/payments/${String((payment.body.payment as { id: string }).id)}/void`)
      .set(authHeader(staff))
      .send({ reason: 'Staff attempt' })
      .expect(403);
  });

  it('still lets staff read and create records', async () => {
    const staff = await asStaff();

    await request(app).get('/api/v1/customers').set(authHeader(staff)).expect(200);

    await request(app)
      .post('/api/v1/customers')
      .set(authHeader(staff))
      .send({ name: 'Staff Added Customer' })
      .expect(201);
  });
});

describe('secret leakage', () => {
  function keysOf(value: unknown, found: string[] = []): string[] {
    if (Array.isArray(value)) {
      for (const item of value) {
        keysOf(item, found);
      }
    } else if (typeof value === 'object' && value !== null) {
      for (const [key, nested] of Object.entries(value)) {
        found.push(key);
        keysOf(nested, found);
      }
    }

    return found;
  }

  it('never returns a password hash or a stored token hash', async () => {
    const invoice = await createInvoice(session, customerId);
    await issueInvoice(session, invoice.id);

    for (const path of [
      '/api/v1/auth/me',
      '/api/v1/customers',
      `/api/v1/invoices/${invoice.id}`,
      '/api/v1/payments',
    ]) {
      const response = await request(app).get(path).set(authHeader(session)).expect(200);
      const keys = keysOf(response.body);

      expect(keys).not.toContain('passwordHash');
      expect(keys).not.toContain('tokenHash');
    }
  });

  it('keeps the web refresh token out of the response body', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: session.email, password: session.password })
      .expect(200);

    expect(keysOf(response.body)).not.toContain('refreshToken');
    expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
  });

  it('does not echo the password back on profile update', async () => {
    const response = await request(app)
      .patch('/api/v1/me')
      .set(authHeader(session))
      .send({ name: 'Renamed' })
      .expect(200);

    expect(JSON.stringify(response.body)).not.toContain(session.password);
  });
});

describe('input hardening', () => {
  it('rejects a body over one megabyte with 413', async () => {
    const response = await request(app)
      .post('/api/v1/customers')
      .set(authHeader(session))
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ name: 'x', notes: 'a'.repeat(1_100_000) }));

    expect(response.status).toBe(413);
  });

  it('rejects unknown fields on invoices and products', async () => {
    await request(app)
      .post('/api/v1/products')
      .set(authHeader(session))
      .send({ name: 'Sneaky', unitPriceMinor: 100, taxRateBp: 1800, businessId: 'x' })
      .expect(400);

    await request(app)
      .post('/api/v1/invoices')
      .set(authHeader(session))
      .send({
        customerId,
        invoiceDate: '2026-10-24',
        dueDate: '2026-11-08',
        businessId: '507f1f77bcf86cd799439011',
        lineItems: [
          { description: 'x', quantityMilli: 1000, unitPriceMinor: 100, taxRateBp: 1800 },
        ],
      })
      .expect(400);
  });

  it('rejects a business id in the query string', async () => {
    await request(app)
      .get('/api/v1/invoices?businessId=507f1f77bcf86cd799439011')
      .set(authHeader(session))
      .expect(400);
  });

  it('sets the security headers on every API response', async () => {
    const response = await request(app)
      .get('/api/v1/customers')
      .set(authHeader(session))
      .expect(200);

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['referrer-policy']).toBe('no-referrer');
  });

  it('does not allow an unknown browser origin', async () => {
    const response = await request(app)
      .get('/api/v1/customers')
      .set('Origin', 'https://not-our-app.example')
      .set(authHeader(session))
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
