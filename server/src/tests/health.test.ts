import { formatPaise } from '@nexora/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { buildApp } from '../app.js';

const app = buildApp();

describe('GET /health', () => {
  it('reports the service as ok', async () => {
    const response = await request(app).get('/health').expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'nexora-invoicepro-api',
      environment: 'test',
    });
    expect(typeof response.body.version).toBe('string');
    expect(response.body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('is also served under the versioned API prefix', async () => {
    const response = await request(app).get('/api/v1/health').expect(200);

    expect(response.body.status).toBe('ok');
  });

  it('describes the API at the v1 root', async () => {
    const response = await request(app).get('/api/v1').expect(200);

    expect(response.body).toMatchObject({
      name: 'Nexora InvoicePro API',
      version: 'v1',
    });
  });
});

describe('request ids', () => {
  it('sets one when the client sends none', async () => {
    const response = await request(app).get('/health').expect(200);
    const header = response.headers['x-request-id'];

    expect(header).toBeTypeOf('string');
    expect(String(header).length).toBeGreaterThanOrEqual(8);
  });

  it('echoes a well formed id from the client', async () => {
    const response = await request(app)
      .get('/health')
      .set('X-Request-Id', 'client-trace-1234')
      .expect(200);

    expect(response.headers['x-request-id']).toBe('client-trace-1234');
  });

  it('replaces an id that contains unsafe characters', async () => {
    const response = await request(app)
      .get('/health')
      .set('X-Request-Id', 'not a valid id!')
      .expect(200);

    expect(response.headers['x-request-id']).not.toBe('not a valid id!');
  });
});

describe('error envelope', () => {
  it('returns a structured 404 with the request id', async () => {
    const response = await request(app).get('/api/v1/does-not-exist').expect(404);

    expect(response.body.error).toMatchObject({
      code: 'NOT_FOUND',
      requestId: response.headers['x-request-id'],
    });
    expect(typeof response.body.error.message).toBe('string');
  });

  it('treats a malformed JSON body as a client error', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ')
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(response.body.error.message).toBe('The request body is not valid JSON');
  });

  it('rejects a body larger than 1 MB', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a'.repeat(1_100_000) }))
      .expect(413);

    expect(response.body.error.message).toContain('1 MB');
  });
});

describe('security middleware', () => {
  it('sets the nosniff header', async () => {
    const response = await request(app).get('/health').expect(200);

    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('does not advertise the framework', async () => {
    const response = await request(app).get('/health').expect(200);

    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('allows the configured web origin', async () => {
    const response = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:5173')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('does not allow an unknown origin', async () => {
    const response = await request(app)
      .get('/health')
      .set('Origin', 'https://not-our-app.example')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('shared workspace package', () => {
  it('resolves and formats money through the built package', () => {
    expect(formatPaise(1_234_567_890)).toBe('₹1,23,45,678.90');
  });
});
