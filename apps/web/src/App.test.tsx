import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';

const session = {
  user: { id: 'u1', name: 'Demo Owner', email: 'demo@nexora.test', phone: null },
  business: {
    id: 'b1',
    name: 'Nexora Technologies',
    legalName: 'Nexora Technologies',
    gstin: '24AAAAA0000A1Z5',
    stateCode: '24',
    address: {
      line1: '',
      line2: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India',
    },
    phone: '',
    email: '',
    website: '',
    currency: 'INR',
  },
  settings: {
    id: 's1',
    invoicePrefix: 'NXP',
    numberSeries: 'INV',
    defaultPaymentTermsDays: 15,
    defaultTaxRateBp: 1800,
    defaultNotes: '',
    paymentInstructions: '',
    bankDetails: {
      accountName: '',
      accountNumber: '',
      ifsc: '',
      bankName: '',
      upiId: '',
    },
    taxInclusivePricing: false,
  },
  role: 'owner',
  accessToken: 'token',
};

const dashboard = {
  range: { from: '2026-10-01', to: '2026-10-24' },
  counts: { total: 3, paid: 1, unpaid: 1, partial: 1, overdue: 0, draft: 0, void: 0 },
  revenue: {
    billedMinor: 10_867_800,
    collectedMinor: 4_622_600,
    outstandingMinor: 6_245_200,
    overdueMinor: 0,
  },
  recentInvoices: [],
  overdueInvoices: [],
};

type Reply = { status: number; body?: unknown };

function stubFetch(reply: (url: string) => Reply): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const result = reply(String(input));

      return {
        ok: result.status >= 200 && result.status < 300,
        status: result.status,
        json: async () => result.body ?? {},
      } as Response;
    }) as unknown as typeof fetch,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('sends an anonymous visitor to the sign in screen', async () => {
    stubFetch((url) => (url.includes('/auth/refresh') ? { status: 401 } : { status: 200 }));

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByText('Demo account')).toBeInTheDocument();
  });

  it('restores a session and renders the dashboard', async () => {
    stubFetch((url) => {
      if (url.includes('/auth/refresh')) {
        return { status: 200, body: session };
      }

      if (url.includes('/dashboard')) {
        return { status: 200, body: dashboard };
      }

      return { status: 200, body: { items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 } };
    });

    render(<App />);

    expect(await screen.findByText(/Good to see you, Demo/)).toBeInTheDocument();
    expect(await screen.findByText('Issued invoices')).toBeInTheDocument();
    expect(await screen.findByText('₹1,08,678.00')).toBeInTheDocument();
  });

  it('shows an error state when the dashboard request fails', async () => {
    stubFetch((url) => {
      if (url.includes('/auth/refresh')) {
        return { status: 200, body: session };
      }

      return {
        status: 500,
        body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } },
      };
    });

    render(<App />);

    expect(await screen.findByText(/dashboard could not load/i)).toBeInTheDocument();
  });
});
