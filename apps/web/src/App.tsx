import { useEffect, useState } from 'react';

import { BrandMark } from './components/BrandMark';
import { API_BASE_URL, fetchHealth, type HealthResponse } from './lib/api';

type ApiState =
  { kind: 'loading' } | { kind: 'ok'; data: HealthResponse } | { kind: 'error'; message: string };

const REPO_URL = 'https://github.com/nexoratechin/nexora-invoicepro';

const foundations = [
  {
    title: 'Money engine',
    body: 'Invoice arithmetic in integer paise, with GST splits and totals that reconcile to the line.',
    facts: ['BigInt rounding, no float drift', 'CGST and SGST split on odd paise', 'Unit tested'],
  },
  {
    title: 'API surface',
    body: 'Express 5 with helmet, a CORS allowlist, rate limits outside tests, request ids and one error envelope.',
    facts: ['GET /health', 'Structured logs with redaction', 'Supertest coverage'],
  },
  {
    title: 'Web shell',
    body: 'Vite, React 19 and Tailwind 4 with the Nexora palette, the N mark and the API client.',
    facts: ['Brand tokens in CSS', 'Typed fetch wrapper', 'Rendered in jsdom'],
  },
];

const nextUp = [
  'User, business and membership models',
  'Registration, login and refresh token rotation',
  'Customers and products with tenant scoping',
];

export function App() {
  const [attempt, setAttempt] = useState(0);
  const [api, setApi] = useState<ApiState>({ kind: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setApi({ kind: 'loading' });

    fetchHealth(controller.signal)
      .then((data) => {
        setApi({ kind: 'ok', data });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setApi({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      });

    return () => {
      controller.abort();
    };
  }, [attempt]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-navy-900/10 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <BrandMark className="h-9 w-9" />
            <div className="leading-tight">
              <p className="text-sm font-semibold text-ink">Nexora InvoicePro</p>
              <p className="text-xs text-ink-muted">Innovate | Automate | Transform</p>
            </div>
          </div>

          <span className="rounded-full border border-brand-blue/20 bg-brand-blue/5 px-3 py-1 text-xs font-medium text-brand-blue">
            Stage 2 of 9
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:py-14">
        <section className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div>
            <p className="text-sm font-medium text-brand-blue">Nexora Technologies</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Invoicing that adds up, to the paisa.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-muted">
              GST invoices, customers, products, payments and reports for small businesses. One
              Express API and one MongoDB database behind a React web app and an Expo mobile app.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setAttempt((value) => value + 1);
                }}
                className="rounded-lg bg-brand-blue px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-blue-dark"
              >
                Check the API again
              </button>
              <a
                href={`${REPO_URL}/tree/main/docs`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-navy-900/15 bg-white px-4 py-2.5 text-sm font-medium text-ink transition hover:border-navy-900/30"
              >
                Read the documentation
              </a>
            </div>
          </div>

          <ApiStatusCard state={api} />
        </section>

        <section className="mt-14">
          <h2 className="text-lg font-semibold text-ink">What exists right now</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Stage 2 sets up the workspace. No screens are built yet, and no data is stored.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {foundations.map((item) => (
              <article
                key={item.title}
                className="rounded-xl border border-navy-900/10 bg-white p-5"
              >
                <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{item.body}</p>
                <ul className="mt-4 space-y-1.5">
                  {item.facts.map((fact) => (
                    <li key={fact} className="flex items-start gap-2 text-xs text-ink-muted">
                      <span
                        aria-hidden="true"
                        className="mt-1.5 h-1.5 w-1.5 rounded-full bg-brand-cyan"
                      />
                      {fact}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-navy-900/10 bg-white p-5">
          <h2 className="text-sm font-semibold text-ink">Stage 3, next</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {nextUp.map((item) => (
              <li key={item} className="text-sm text-ink-muted">
                {item}
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t border-navy-900/10 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-5 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>Nexora Technologies. Tax figures are software calculations, not tax advice.</p>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-brand-blue"
          >
            github.com/nexoratechin/nexora-invoicepro
          </a>
        </div>
      </footer>
    </div>
  );
}

function ApiStatusCard({ state }: { state: ApiState }) {
  return (
    <section
      aria-live="polite"
      className="rounded-xl border border-navy-900/10 bg-navy-900 p-5 text-mist shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">API status</h2>
        <StatusPill state={state} />
      </div>

      <p className="mt-3 break-all font-mono text-xs text-mist/60">{API_BASE_URL}</p>

      {state.kind === 'loading' && <p className="mt-4 text-sm text-mist/70">Asking the API.</p>}

      {state.kind === 'ok' && (
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
          <Fact label="Service" value={state.data.service} />
          <Fact label="Version" value={state.data.version} />
          <Fact label="Environment" value={state.data.environment} />
          <Fact label="Uptime" value={`${String(state.data.uptimeSeconds)}s`} />
        </dl>
      )}

      {state.kind === 'error' && (
        <div className="mt-4">
          <p className="text-sm text-mist/80">
            Not reachable. Start it with <code className="font-mono">npm run dev:api</code>.
          </p>
          <p className="mt-2 text-xs text-mist/50">{state.message}</p>
        </div>
      )}
    </section>
  );
}

function StatusPill({ state }: { state: ApiState }) {
  if (state.kind === 'loading') {
    return (
      <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-mist/80">
        Checking
      </span>
    );
  }

  if (state.kind === 'ok') {
    return (
      <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-medium text-emerald-300">
        Connected
      </span>
    );
  }

  return (
    <span className="rounded-full bg-red-400/15 px-2.5 py-1 text-xs font-medium text-red-300">
      Offline
    </span>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-mist/50">{label}</dt>
      <dd className="mt-0.5 font-mono text-mist">{value}</dd>
    </div>
  );
}
