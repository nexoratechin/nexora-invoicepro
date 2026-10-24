import type { Express } from 'express';
import request from 'supertest';
import { expect } from 'vitest';

import { buildApp } from '../../app.js';

export const app: Express = buildApp();

export interface TestSession {
  accessToken: string;
  refreshToken: string;
  businessId: string;
  userId: string;
  email: string;
  password: string;
}

let counter = 0;

export function uniqueEmail(prefix = 'user'): string {
  counter += 1;

  return `${prefix}.${Date.now().toString(36)}.${String(counter)}@nexora.test`;
}

export async function registerAccount(
  overrides: Partial<{
    name: string;
    email: string;
    password: string;
    businessName: string;
    stateCode: string;
  }> = {},
): Promise<TestSession> {
  const email = overrides.email ?? uniqueEmail();
  const password = overrides.password ?? 'correct-horse-battery';

  const response = await request(app)
    .post('/api/v1/auth/register')
    .set('X-Client-Platform', 'mobile')
    .send({
      name: overrides.name ?? 'Test Owner',
      email,
      password,
      businessName: overrides.businessName ?? 'Test Studio',
      stateCode: overrides.stateCode ?? '24',
    })
    .expect(201);

  expect(response.body.accessToken).toBeTypeOf('string');
  expect(response.body.refreshToken).toBeTypeOf('string');

  return {
    accessToken: response.body.accessToken as string,
    refreshToken: response.body.refreshToken as string,
    businessId: response.body.business.id as string,
    userId: response.body.user.id as string,
    email,
    password,
  };
}

export function authHeader(session: TestSession): { Authorization: string } {
  return { Authorization: `Bearer ${session.accessToken}` };
}

export async function createCustomer(
  session: TestSession,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const response = await request(app)
    .post('/api/v1/customers')
    .set(authHeader(session))
    .send({ name: 'Acme Traders', stateCode: '27', ...overrides })
    .expect(201);

  return response.body.customer.id as string;
}

export async function createProduct(
  session: TestSession,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const response = await request(app)
    .post('/api/v1/products')
    .set(authHeader(session))
    .send({
      name: 'Website redesign',
      unitPriceMinor: 2_500_000,
      taxRateBp: 1800,
      ...overrides,
    })
    .expect(201);

  return response.body.product.id as string;
}

export const DEFAULT_LINE_ITEMS = [
  {
    description: 'Website redesign, 5 pages',
    quantityMilli: 1000,
    unitPriceMinor: 2_500_000,
    taxRateBp: 1800,
  },
  {
    description: 'Hosting, 12 months',
    quantityMilli: 12_000,
    unitPriceMinor: 50_000,
    discountBp: 500,
    taxRateBp: 1800,
  },
];

export async function createInvoice(
  session: TestSession,
  customerId: string,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; body: Record<string, unknown> }> {
  const today = new Date().toISOString().slice(0, 10);
  const later = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const response = await request(app)
    .post('/api/v1/invoices')
    .set(authHeader(session))
    .send({
      customerId,
      invoiceDate: today,
      dueDate: later,
      lineItems: DEFAULT_LINE_ITEMS,
      ...overrides,
    })
    .expect(201);

  return {
    id: response.body.invoice.id as string,
    body: response.body.invoice as Record<string, unknown>,
  };
}

export async function issueInvoice(
  session: TestSession,
  invoiceId: string,
): Promise<Record<string, unknown>> {
  const response = await request(app)
    .post(`/api/v1/invoices/${invoiceId}/issue`)
    .set(authHeader(session))
    .expect(200);

  return response.body.invoice as Record<string, unknown>;
}

export async function recordPayment(
  session: TestSession,
  invoiceId: string,
  overrides: Record<string, unknown> = {},
  idempotencyKey: string = `key-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await request(app)
    .post(`/api/v1/invoices/${invoiceId}/payments`)
    .set(authHeader(session))
    .set('Idempotency-Key', idempotencyKey)
    .send({
      amountMinor: 1_000_000,
      paidAt: new Date().toISOString().slice(0, 10),
      method: 'upi',
      reference: 'UPI/123',
      ...overrides,
    });

  return { status: response.status, body: response.body as Record<string, unknown> };
}
