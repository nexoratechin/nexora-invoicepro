import { useState } from 'react';

import { Button, Card, Skeleton } from '../components/ui';
import { PageHeader } from '../components/layout';
import { money, monthStartIso, todayIso } from '../lib/format';
import { useApi } from '../lib/useApi';

const tabs = [
  { id: 'summary', label: 'Summary' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'gst', label: 'GST' },
  { id: 'outstanding', label: 'Outstanding' },
  { id: 'customers', label: 'Top customers' },
] as const;

type TabId = (typeof tabs)[number]['id'];

interface Summary {
  invoiceCount: number;
  billedMinor: number;
  collectedMinor: number;
  outstandingMinor: number;
  taxableValueMinor: number;
  taxCollectedMinor: number;
  paymentsReceivedMinor: number;
  averageInvoiceMinor: number;
  range: { from: string; to: string };
}

interface Revenue {
  points: { month: string; billedMinor: number; collectedMinor: number; invoiceCount: number }[];
}

interface Gst {
  rows: {
    taxRateBp: number;
    taxableValueMinor: number;
    cgstMinor: number;
    sgstMinor: number;
    igstMinor: number;
    taxMinor: number;
  }[];
  totals: {
    taxableValueMinor: number;
    cgstMinor: number;
    sgstMinor: number;
    igstMinor: number;
    taxMinor: number;
  };
}

interface Outstanding {
  asOf: string;
  buckets: { bucket: string; amountMinor: number; invoiceCount: number }[];
  totalMinor: number;
}

interface TopCustomers {
  rows: {
    customerId: string;
    name: string;
    billedMinor: number;
    outstandingMinor: number;
    invoiceCount: number;
  }[];
}

export function ReportsPage() {
  const [tab, setTab] = useState<TabId>('summary');
  const today = todayIso();
  const [from, setFrom] = useState(`${today.slice(0, 4)}-01-01`);
  const [to, setTo] = useState(today);
  const range = `from=${from}&to=${to}`;

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Built from stored invoices and payments. Void and draft invoices are excluded."
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-xs text-ink-muted">
          From
          <input
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
            }}
            className="mt-1 block rounded-lg border border-navy-900/15 bg-white px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="text-xs text-ink-muted">
          To
          <input
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
            }}
            className="mt-1 block rounded-lg border border-navy-900/15 bg-white px-3 py-2 text-sm text-ink"
          />
        </label>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setFrom(monthStartIso(today));
            setTo(today);
          }}
        >
          This month
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setFrom(`${today.slice(0, 4)}-01-01`);
            setTo(today);
          }}
        >
          This year
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={tab === option.id}
            onClick={() => {
              setTab(option.id);
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              tab === option.id
                ? 'bg-navy-900 text-white'
                : 'bg-white text-ink-muted ring-1 ring-inset ring-navy-900/10 hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {tab === 'summary' && <SummaryReport range={range} />}
      {tab === 'revenue' && <RevenueReport range={range} />}
      {tab === 'gst' && <GstReport range={range} />}
      {tab === 'outstanding' && <OutstandingReport />}
      {tab === 'customers' && <TopCustomersReport range={range} />}
    </div>
  );
}

function SummaryReport({ range }: { range: string }) {
  const { data, loading, error } = useApi<Summary>(`/reports/summary?${range}`);

  if (loading && data === null) return <Skeleton className="h-40 rounded-xl" />;
  if (error !== null) return <p className="text-sm text-red-700">{error.message}</p>;
  if (data === null) return null;

  const tiles = [
    { label: 'Invoices issued', value: String(data.invoiceCount) },
    { label: 'Billed', value: money(data.billedMinor) },
    { label: 'Collected', value: money(data.collectedMinor) },
    { label: 'Outstanding', value: money(data.outstandingMinor) },
    { label: 'Taxable value', value: money(data.taxableValueMinor) },
    { label: 'Tax', value: money(data.taxCollectedMinor) },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-xl border border-navy-900/10 bg-white p-4">
          <p className="text-xs text-ink-muted">{tile.label}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-ink">{tile.value}</p>
        </div>
      ))}
      <div className="rounded-xl border border-navy-900/10 bg-white p-4 sm:col-span-2 lg:col-span-3">
        <p className="text-xs text-ink-muted">Average invoice value</p>
        <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
          {money(data.averageInvoiceMinor)}
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          {money(data.paymentsReceivedMinor)} received in this range, across all invoices.
        </p>
      </div>
    </div>
  );
}

function RevenueReport({ range }: { range: string }) {
  const { data, loading, error } = useApi<Revenue>(`/reports/revenue?${range}&groupBy=month`);

  if (loading && data === null) return <Skeleton className="h-40 rounded-xl" />;
  if (error !== null) return <p className="text-sm text-red-700">{error.message}</p>;
  if (data === null) return null;

  if (data.points.length === 0) {
    return (
      <Card title="No revenue in this range">
        <p className="text-sm text-ink-muted">Issue an invoice, or widen the dates.</p>
      </Card>
    );
  }

  const peak = Math.max(...data.points.map((point) => point.billedMinor), 1);

  return (
    <Card title="Revenue by month" description="Billed against collected, month by month." flush>
      <ul className="divide-y divide-navy-900/5">
        {data.points.map((point) => (
          <li key={point.month} className="px-5 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium text-ink">{point.month}</p>
              <p className="text-sm tabular-nums text-ink">
                {money(point.billedMinor)}
                <span className="ml-2 text-xs text-ink-muted">{point.invoiceCount} invoices</span>
              </p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-navy-900/10">
              <div
                className="h-full rounded-full bg-brand-blue"
                style={{ width: `${String(Math.round((point.billedMinor / peak) * 100))}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-ink-muted">{money(point.collectedMinor)} collected</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function GstReport({ range }: { range: string }) {
  const { data, loading, error } = useApi<Gst>(`/reports/gst?${range}`);

  if (loading && data === null) return <Skeleton className="h-40 rounded-xl" />;
  if (error !== null) return <p className="text-sm text-red-700">{error.message}</p>;
  if (data === null) return null;

  return (
    <Card
      title="GST summary"
      description="Taxable value and the tax split, by rate. Not a filing document."
      flush
    >
      {data.rows.length === 0 ? (
        <p className="p-5 text-sm text-ink-muted">No issued invoices in this range.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-mist text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th scope="col" className="px-5 py-2.5 font-medium">
                  Rate
                </th>
                <th scope="col" className="px-5 py-2.5 text-right font-medium">
                  Taxable
                </th>
                <th scope="col" className="hidden px-5 py-2.5 text-right font-medium sm:table-cell">
                  CGST
                </th>
                <th scope="col" className="hidden px-5 py-2.5 text-right font-medium sm:table-cell">
                  SGST
                </th>
                <th scope="col" className="hidden px-5 py-2.5 text-right font-medium md:table-cell">
                  IGST
                </th>
                <th scope="col" className="px-5 py-2.5 text-right font-medium">
                  Tax
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-900/5">
              {data.rows.map((row) => (
                <tr key={row.taxRateBp}>
                  <td className="px-5 py-3 text-ink">{row.taxRateBp / 100}%</td>
                  <td className="px-5 py-3 text-right tabular-nums text-ink">
                    {money(row.taxableValueMinor)}
                  </td>
                  <td className="hidden px-5 py-3 text-right tabular-nums text-ink-muted sm:table-cell">
                    {money(row.cgstMinor)}
                  </td>
                  <td className="hidden px-5 py-3 text-right tabular-nums text-ink-muted sm:table-cell">
                    {money(row.sgstMinor)}
                  </td>
                  <td className="hidden px-5 py-3 text-right tabular-nums text-ink-muted md:table-cell">
                    {money(row.igstMinor)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums font-medium text-ink">
                    {money(row.taxMinor)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-navy-900/10 bg-mist">
              <tr>
                <td className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-ink-muted">
                  Total
                </td>
                <td className="px-5 py-3 text-right tabular-nums font-medium text-ink">
                  {money(data.totals.taxableValueMinor)}
                </td>
                <td className="hidden px-5 py-3 text-right tabular-nums text-ink sm:table-cell">
                  {money(data.totals.cgstMinor)}
                </td>
                <td className="hidden px-5 py-3 text-right tabular-nums text-ink sm:table-cell">
                  {money(data.totals.sgstMinor)}
                </td>
                <td className="hidden px-5 py-3 text-right tabular-nums text-ink md:table-cell">
                  {money(data.totals.igstMinor)}
                </td>
                <td className="px-5 py-3 text-right tabular-nums font-semibold text-ink">
                  {money(data.totals.taxMinor)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  );
}

function OutstandingReport() {
  const { data, loading, error } = useApi<Outstanding>('/reports/outstanding');

  if (loading && data === null) return <Skeleton className="h-40 rounded-xl" />;
  if (error !== null) return <p className="text-sm text-red-700">{error.message}</p>;
  if (data === null) return null;

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.buckets.map((bucket) => (
          <div key={bucket.bucket} className="rounded-xl border border-navy-900/10 bg-white p-4">
            <p className="text-xs text-ink-muted">
              {bucket.bucket === '60+' ? 'Over 60 days' : `${bucket.bucket} days`}
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-ink">
              {money(bucket.amountMinor)}
            </p>
            <p className="text-xs text-ink-muted">
              {bucket.invoiceCount} invoice{bucket.invoiceCount === 1 ? '' : 's'}
            </p>
          </div>
        ))}
      </div>
      <Card title="Total outstanding" className="mt-4">
        <p className="text-2xl font-semibold tabular-nums text-ink">{money(data.totalMinor)}</p>
        <p className="mt-1 text-xs text-ink-muted">
          As of {data.asOf}. Buckets are days past the due date.
        </p>
      </Card>
    </div>
  );
}

function TopCustomersReport({ range }: { range: string }) {
  const { data, loading, error } = useApi<TopCustomers>(`/reports/top-customers?${range}&limit=5`);

  if (loading && data === null) return <Skeleton className="h-40 rounded-xl" />;
  if (error !== null) return <p className="text-sm text-red-700">{error.message}</p>;
  if (data === null) return null;

  return (
    <Card title="Top customers" description="By billed value in the selected range." flush>
      {data.rows.length === 0 ? (
        <p className="p-5 text-sm text-ink-muted">No issued invoices in this range.</p>
      ) : (
        <ul className="divide-y divide-navy-900/5">
          {data.rows.map((row) => (
            <li key={row.customerId} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{row.name}</p>
                <p className="text-xs text-ink-muted">
                  {row.invoiceCount} invoice{row.invoiceCount === 1 ? '' : 's'} ·{' '}
                  {money(row.outstandingMinor)} outstanding
                </p>
              </div>
              <p className="text-sm tabular-nums text-ink">{money(row.billedMinor)}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
