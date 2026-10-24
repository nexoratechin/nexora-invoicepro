import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { app } from './helpers/api.js';

describe('API documentation', () => {
  it('serves the OpenAPI document', async () => {
    const response = await request(app).get('/api/openapi.json').expect(200);

    expect(response.body.openapi).toBe('3.1.0');
    expect(response.body.info.title).toBe('Nexora InvoicePro API');
    expect(Object.keys(response.body.paths as Record<string, unknown>).length).toBeGreaterThan(20);
    expect(response.body.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
  });

  it('documents the invoice and payment endpoints', async () => {
    const response = await request(app).get('/api/openapi.json').expect(200);
    const paths = response.body.paths as Record<string, unknown>;

    for (const path of [
      '/invoices',
      '/invoices/{id}/issue',
      '/invoices/{id}/void',
      '/invoices/{id}/payments',
      '/payments/{id}/void',
      '/reports/gst',
    ]) {
      expect(paths).toHaveProperty([path]);
    }
  });

  it('serves the Swagger UI page', async () => {
    const response = await request(app).get('/api/docs/').expect(200);

    expect(response.text).toContain('swagger');
  });

  it('keeps the strict CSP on API responses but not on the docs page', async () => {
    const api = await request(app).get('/api/v1').expect(200);
    const docs = await request(app).get('/api/docs/').expect(200);

    expect(api.headers['content-security-policy']).toContain("default-src 'self'");
    expect(docs.headers['content-security-policy']).toBeUndefined();
  });
});
