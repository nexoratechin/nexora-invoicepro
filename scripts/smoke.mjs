#!/usr/bin/env node
/**
 * Post deploy smoke test. Run it against a deployed API:
 *
 *   node scripts/smoke.mjs https://your-api.onrender.com
 *
 * It signs in with the demo account, reads the dashboard, opens the first
 * invoice and downloads its PDF. Exit code 1 on the first failure.
 */

const base = (process.argv[2] ?? process.env.API_URL ?? 'http://localhost:4000').replace(
  /\/+$/,
  '',
);
const email = process.env.SMOKE_EMAIL ?? 'demo@nexora.test';
const password = process.env.SMOKE_PASSWORD ?? 'nexora-demo-password';

let failures = 0;

function pass(label, detail = '') {
  console.log(`  PASS  ${label}${detail === '' ? '' : ` (${detail})`}`);
}

function fail(label, detail) {
  failures += 1;
  console.log(`  FAIL  ${label}: ${detail}`);
}

async function step(label, run) {
  try {
    const detail = await run();
    pass(label, detail ?? '');
  } catch (error) {
    fail(label, error instanceof Error ? error.message : String(error));
  }
}

async function json(path, init = {}) {
  const response = await fetch(`${base}${path}`, init);

  if (!response.ok) {
    throw new Error(`${path} returned ${String(response.status)}`);
  }

  return response.json();
}

console.log(`Smoke test against ${base}\n`);

await step('health', async () => {
  const body = await json('/health');
  if (body.status !== 'ok') throw new Error(`status was ${String(body.status)}`);
  return `v${String(body.version)}`;
});

await step('database readiness', async () => {
  const body = await json('/health/db');
  if (body.status !== 'ok') throw new Error('database not ready');
  return body.database;
});

let token = '';

await step('sign in as the demo owner', async () => {
  const body = await json('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Client-Platform': 'mobile' },
    body: JSON.stringify({ email, password }),
  });
  token = body.accessToken;
  if (typeof token !== 'string' || token.length < 20) throw new Error('no access token');
  return `${body.business.name}, ${body.role}`;
});

const auth = () => ({ Authorization: `Bearer ${token}` });

await step('dashboard', async () => {
  const body = await json('/api/v1/dashboard', { headers: auth() });
  return `${String(body.counts.total)} issued invoices`;
});

let invoiceId = '';

await step('invoice list', async () => {
  const body = await json('/api/v1/invoices?pageSize=1', { headers: auth() });
  if (body.total === 0) throw new Error('no invoices, run the seed first');
  invoiceId = body.items[0].id;
  return `${String(body.total)} total`;
});

await step('invoice detail', async () => {
  const body = await json(`/api/v1/invoices/${invoiceId}`, { headers: auth() });
  return body.invoice.invoiceNumber ?? 'draft';
});

await step('invoice PDF', async () => {
  const response = await fetch(`${base}/api/v1/invoices/${invoiceId}/pdf`, { headers: auth() });
  if (!response.ok) throw new Error(`PDF returned ${String(response.status)}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.subarray(0, 5).toString() !== '%PDF-') throw new Error('not a PDF');
  return `${String(Math.round(buffer.length / 1024))} kB`;
});

await step('rejects an anonymous request', async () => {
  const response = await fetch(`${base}/api/v1/customers`);
  if (response.status !== 401) throw new Error(`expected 401, got ${String(response.status)}`);
  return '401';
});

console.log(failures === 0 ? '\nAll checks passed.' : `\n${String(failures)} check(s) failed.`);

process.exit(failures === 0 ? 0 : 1);
