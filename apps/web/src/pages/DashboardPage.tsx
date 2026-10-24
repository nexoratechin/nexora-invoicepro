import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Clock, Plus, Receipt, TrendingUp, Users, Wallet } from 'lucide-react';
import { useState } from 'react';

import { Badge, Button, Card, EmptyState, LinkButton, Skeleton } from '../components/ui';
import { InvoiceStatusBadge } from '../components/StatusBadge';
import { PageHeader } from '../components/layout';
import { useAuth } from '../lib/auth';
import { formatDate, money, monthStartIso, todayIso } from '../lib/format';
import { invoiceCustomerName, type ApiInvoice } from '../lib/invoice';
import { useApi } from '../lib/useApi';

interface DashboardResponse {
  range: { from: string; to: string };
  counts: {
    total: number;
    paid: number;
    unpaid: number;
    partial: number;
    overdue: number;
    draft: number;
    void: number;
  };
  revenue: {
    billedMinor: number;
    collectedMinor: number;
    outstandingMinor: number;
    overdueMinor: number;
  };
  recentInvoices: ApiInvoice[];
  overdueInvoices: ApiInvoice[];
}

const ranges = [
  { id: 'month', label: 'This month' },
  { id: 'quarter', label: 'Last 90 days' },
  { id: 'year', label: 'This year' },
] as const;

function rangeFor(id: (typeof ranges)[number]['id']): { from: string; to: string } {
  const today = todayIso();

  if (id === 'month') {
    return { from: monthStartIso(today), to: today };
  }

  if (id === 'quarter') {
    const date = new Date(`${today}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() - 90);

    return { from: date.toISOString().slice(0, 10), to: today };
  }

  return { from: `${today.slice(0, 4)}-01-01`, to: today };
}

export function DashboardPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [rangeId, setRangeId] = useState<(typeof ranges)[number]['id']>('month');
  const range = rangeFor(rangeId);
  const { data, loading, error, reload } = useApi<DashboardResponse>(
    `/dashboard?from=${range.from}&to=${range.to}`,
  );

  const isEmpty = data !== null && data.counts.total === 0 && data.counts.draft === 0;

  return (
    <div>
      <PageHeader
        title={`Good to see you, ${session?.user.name.split(' ')[0] ?? 'there'}`}
        description="Where the money stands, and what needs chasing."
        actions={
          <LinkButton to="/invoices/new">
            <Plus aria-hidden="true" className="h-4 w-4" />
            New invoice
          </LinkButton>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {ranges.map((rangeOption) => (
          <button
            key={rangeOption.id}
            type="button"
            onClick={() => {
              setRangeId(rangeOption.id);
            }}
            aria-pressed={rangeId === rangeOption.id}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              rangeId === rangeOption.id
                ? 'bg-navy-900 text-white'
                : 'bg-white text-ink-muted ring-1 ring-inset ring-navy-900/10 hover:text-ink'
            }`}
          >
            {rangeOption.label}
          </button>
        ))}
      </div>

      {loading && data === null && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
      )}

      {error !== null && (
        <Card title="The dashboard could not load">
          <p className="text-sm text-ink-muted">{error.message}</p>
          <Button variant="secondary" className="mt-3" onClick={reload}>
            Try again
          </Button>
        </Card>
      )}

      {data !== null && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Issued invoices"
              value={String(data.counts.total)}
              hint={`${String(data.counts.draft)} draft${data.counts.draft === 1 ? '' : 's'}`}
              icon={<Receipt aria-hidden="true" className="h-4 w-4" />}
            />
            <StatCard
              label="Paid"
              value={String(data.counts.paid)}
              hint={`${String(data.counts.partial)} part paid`}
              tone="green"
              icon={<Wallet aria-hidden="true" className="h-4 w-4" />}
            />
            <StatCard
              label="Unpaid"
              value={String(data.counts.unpaid)}
              hint="Awaiting payment"
              tone="amber"
              icon={<Users aria-hidden="true" className="h-4 w-4" />}
            />
            <StatCard
              label="Overdue"
              value={String(data.counts.overdue)}
              hint={money(data.revenue.overdueMinor)}
              tone="red"
              icon={<Clock aria-hidden="true" className="h-4 w-4" />}
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Card
              title="Revenue"
              description={`${formatDate(data.range.from)} to ${formatDate(data.range.to)}`}
            >
              <dl className="space-y-3">
                <MoneyRow label="Billed" value={money(data.revenue.billedMinor)} strong />
                <MoneyRow label="Collected" value={money(data.revenue.collectedMinor)} />
                <MoneyRow label="Outstanding" value={money(data.revenue.outstandingMinor)} />
              </dl>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-navy-900/10">
                <div
                  className="h-full rounded-full bg-brand-cyan"
                  style={{
                    width: `${
                      data.revenue.billedMinor === 0
                        ? 0
                        : Math.min(
                            100,
                            Math.round(
                              (data.revenue.collectedMinor / data.revenue.billedMinor) * 100,
                            ),
                          )
                    }%`,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-ink-muted">
                {data.revenue.billedMinor === 0
                  ? 'Nothing billed in this range yet.'
                  : `${String(
                      Math.round((data.revenue.collectedMinor / data.revenue.billedMinor) * 100),
                    )}% collected`}
              </p>
            </Card>

            <Card
              title="Recent invoices"
              className="lg:col-span-2"
              actions={
                <Link
                  to="/invoices"
                  className="text-xs font-medium text-brand-blue hover:underline"
                >
                  View all
                </Link>
              }
              flush
            >
              {isEmpty ? (
                <EmptyState
                  icon={<Receipt aria-hidden="true" className="h-5 w-5" />}
                  title="No invoices yet"
                  description="Add a customer, then raise your first invoice. It takes about a minute."
                  action={<LinkButton to="/invoices/new">Create an invoice</LinkButton>}
                />
              ) : data.recentInvoices.length === 0 ? (
                <EmptyState
                  icon={<TrendingUp aria-hidden="true" className="h-5 w-5" />}
                  title="Nothing in this range"
                  description="Try a wider date range, or raise a new invoice."
                />
              ) : (
                <ul className="divide-y divide-navy-900/5">
                  {data.recentInvoices.map((invoice) => (
                    <li key={invoice.id}>
                      <button
                        type="button"
                        onClick={() => {
                          navigate(`/invoices/${invoice.id}`);
                        }}
                        className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-mist"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">
                            {invoice.invoiceNumber ?? 'Draft'} · {invoiceCustomerName(invoice)}
                          </p>
                          <p className="text-xs text-ink-muted">
                            {formatDate(invoice.invoiceDate)} · due {formatDate(invoice.dueDate)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium tabular-nums text-ink">
                            {money(invoice.totals.totalMinor)}
                          </p>
                          <p className="text-xs text-ink-muted tabular-nums">
                            {money(invoice.balanceDueMinor)} due
                          </p>
                        </div>
                        <InvoiceStatusBadge
                          status={invoice.status}
                          paymentState={invoice.paymentState}
                          overdue={invoice.overdue}
                        />
                        <ArrowRight aria-hidden="true" className="h-4 w-4 text-ink-muted" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {data.overdueInvoices.length > 0 && (
            <Card
              title="Needs chasing"
              description="Issued, past the due date, still unpaid."
              className="mt-4"
              actions={<Badge tone="red">{data.overdueInvoices.length} overdue</Badge>}
              flush
            >
              <ul className="divide-y divide-navy-900/5">
                {data.overdueInvoices.map((invoice) => (
                  <li key={invoice.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">
                        {invoice.invoiceNumber ?? 'Draft'} · {invoiceCustomerName(invoice)}
                      </p>
                      <p className="text-xs text-ink-muted">Due {formatDate(invoice.dueDate)}</p>
                    </div>
                    <p className="text-sm font-medium tabular-nums text-red-700">
                      {money(invoice.balanceDueMinor)}
                    </p>
                    <Link
                      to={`/invoices/${invoice.id}`}
                      className="text-xs font-medium text-brand-blue hover:underline"
                    >
                      Open
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'blue',
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  tone?: 'blue' | 'green' | 'amber' | 'red';
}) {
  const tones = {
    blue: 'bg-brand-blue/10 text-brand-blue',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
  }[tone];

  return (
    <div className="rounded-xl border border-navy-900/10 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tones}`}>
          {icon}
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>
    </div>
  );
}

function MoneyRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={`text-sm ${strong ? 'font-medium text-ink' : 'text-ink-muted'}`}>{label}</dt>
      <dd
        className={`tabular-nums ${strong ? 'text-lg font-semibold text-ink' : 'text-sm text-ink'}`}
      >
        {value}
      </dd>
    </div>
  );
}
