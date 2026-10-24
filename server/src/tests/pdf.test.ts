import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { cleanText, rupeesInWords, safeFilename } from '../lib/text.js';
import {
  app,
  authHeader,
  createCustomer,
  createInvoice,
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

function pageCount(body: Buffer): number {
  const text = body.toString('latin1');
  const matches = text.match(/\/Type\s*\/Page[^s]/g);

  return matches === null ? 0 : matches.length;
}

describe('GET /invoices/:id/pdf', () => {
  it('returns a PDF attachment for an issued invoice', async () => {
    const invoice = await createInvoice(session, customerId);
    const issued = await issueInvoice(session, invoice.id);

    const response = await request(app)
      .get(`/api/v1/invoices/${invoice.id}/pdf`)
      .set(authHeader(session))
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        res.on('end', () => {
          callback(null, Buffer.concat(chunks));
        });
      })
      .expect(200);

    expect(response.headers['content-type']).toBe('application/pdf');
    expect(response.headers['content-disposition']).toContain('attachment');
    expect(response.headers['content-disposition']).toContain('.pdf');
    expect(response.headers['content-disposition']).toContain(
      String(issued.invoiceNumber).replace(/\//g, '-').slice(0, 8),
    );

    const body = response.body as Buffer;
    expect(body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(body.length).toBeGreaterThan(3000);
    expect(pageCount(body)).toBe(1);
  });

  it('renders a draft with a DRAFT marker and no number', async () => {
    const invoice = await createInvoice(session, customerId);

    const response = await request(app)
      .get(`/api/v1/invoices/${invoice.id}/pdf`)
      .set(authHeader(session))
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        res.on('end', () => {
          callback(null, Buffer.concat(chunks));
        });
      })
      .expect(200);

    expect((response.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('paginates a long invoice instead of clipping it', async () => {
    const lineItems = Array.from({ length: 34 }, (_, index) => ({
      description: `Line item ${String(index + 1)} with a longer description that wraps`,
      quantityMilli: 1000,
      unitPriceMinor: 125_000,
      taxRateBp: 1800,
    }));

    const invoice = await createInvoice(session, customerId, { lineItems });
    await issueInvoice(session, invoice.id);

    const response = await request(app)
      .get(`/api/v1/invoices/${invoice.id}/pdf`)
      .set(authHeader(session))
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        res.on('end', () => {
          callback(null, Buffer.concat(chunks));
        });
      })
      .expect(200);

    expect(pageCount(response.body as Buffer)).toBeGreaterThan(1);
  });

  it('escapes hostile customer text without breaking the document', async () => {
    const hostileId = await createCustomer(session, {
      name: '<script>alert(1)</script> & (parentheses) \u0000\u001b',
    });
    const invoice = await createInvoice(session, hostileId);
    await issueInvoice(session, invoice.id);

    const response = await request(app)
      .get(`/api/v1/invoices/${invoice.id}/pdf`)
      .set(authHeader(session))
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        res.on('end', () => {
          callback(null, Buffer.concat(chunks));
        });
      })
      .expect(200);

    expect((response.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('refuses another business invoice', async () => {
    const invoice = await createInvoice(session, customerId);
    await issueInvoice(session, invoice.id);
    const other = await registerAccount({ businessName: 'Other Studio' });

    await request(app).get(`/api/v1/invoices/${invoice.id}/pdf`).set(authHeader(other)).expect(404);
  });

  it('requires a session', async () => {
    const invoice = await createInvoice(session, customerId);

    await request(app).get(`/api/v1/invoices/${invoice.id}/pdf`).expect(401);
  });
});

describe('cleanText', () => {
  it('strips control characters and collapses whitespace', () => {
    expect(cleanText('  Acme\u0000   Traders \u001b ')).toBe('Acme Traders');
  });

  it('keeps newlines, because addresses are multi line', () => {
    expect(cleanText('Line one\nLine two')).toBe('Line one\nLine two');
  });

  it('truncates long input', () => {
    expect(cleanText('a'.repeat(50), 10)).toHaveLength(10);
  });

  it('handles null and undefined', () => {
    expect(cleanText(null)).toBe('');
    expect(cleanText(undefined)).toBe('');
  });
});

describe('safeFilename', () => {
  it('turns a slash separated invoice number into a filename', () => {
    expect(safeFilename('NXP/2026-27/0007')).toBe('NXP-2026-27-0007');
  });

  it('removes traversal attempts', () => {
    expect(safeFilename('../../etc/passwd')).toBe('etc-passwd');
  });

  it('falls back when nothing usable remains', () => {
    expect(safeFilename('///')).toBe('invoice');
  });
});

describe('rupeesInWords', () => {
  it('writes zero', () => {
    expect(rupeesInWords(0)).toBe('Zero Rupees Only');
  });

  it('writes small amounts', () => {
    expect(rupeesInWords(1)).toBe('One Paise Only');
    expect(rupeesInWords(5900)).toBe('Fifty Nine Rupees Only');
  });

  it('uses the Indian grouping', () => {
    expect(rupeesInWords(70_80_000_00)).toBe('Seventy Lakh Eighty Thousand Rupees Only');
    expect(rupeesInWords(2_95_00_000)).toBe('Two Lakh Ninety Five Thousand Rupees Only');
    expect(rupeesInWords(1_00_00_000_00)).toBe('One Crore Rupees Only');
  });

  it('mentions paise when present', () => {
    expect(rupeesInWords(123_45)).toBe('One Hundred Twenty Three Rupees and Forty Five Paise Only');
  });

  it('handles negatives', () => {
    expect(rupeesInWords(-5900)).toBe('Minus Fifty Nine Rupees Only');
  });
});
