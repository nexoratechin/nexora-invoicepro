import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';

function stubFetch(implementation: () => Promise<unknown>): void {
  vi.stubGlobal('fetch', vi.fn(implementation) as unknown as typeof fetch);
}

function jsonResponse(body: unknown, status = 200): unknown {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('renders the product name and brand mark', () => {
    stubFetch(() => new Promise(() => undefined));
    render(<App />);

    expect(screen.getAllByText('Nexora InvoicePro').length).toBeGreaterThan(0);
    expect(screen.getByRole('img', { name: 'Nexora Technologies' })).toBeInTheDocument();
  });

  it('shows the API as connected when health responds', async () => {
    stubFetch(() =>
      Promise.resolve(
        jsonResponse({
          status: 'ok',
          service: 'nexora-invoicepro-api',
          version: '0.1.0',
          environment: 'test',
          uptimeSeconds: 12,
          timestamp: new Date().toISOString(),
        }),
      ),
    );

    render(<App />);

    expect(await screen.findByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('nexora-invoicepro-api')).toBeInTheDocument();
    expect(screen.getByText('12s')).toBeInTheDocument();
  });

  it('explains how to start the API when the request fails', async () => {
    stubFetch(() => Promise.reject(new Error('Failed to fetch')));

    render(<App />);

    expect(await screen.findByText('Offline')).toBeInTheDocument();
    expect(screen.getByText(/Start it with/)).toBeInTheDocument();
  });

  it('reports a non 200 response as offline', async () => {
    stubFetch(() => Promise.resolve(jsonResponse({ error: 'nope' }, 500)));

    render(<App />);

    expect(await screen.findByText('Offline')).toBeInTheDocument();
    expect(screen.getByText('The API responded with 500')).toBeInTheDocument();
  });
});
