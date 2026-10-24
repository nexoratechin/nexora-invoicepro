import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Plus, Search } from 'lucide-react';

import {
  Button,
  Card,
  EmptyState,
  Input,
  LinkButton,
  Pagination,
  Select,
  Skeleton,
} from '../components/ui';
import { PageHeader } from '../components/layout';
import { InvoiceStatusBadge } from '../components/StatusBadge';
import { formatDate, money } from '../lib/format';
import { invoiceCustomerName, type ApiInvoice, type Page } from '../lib/invoice';
import { useApi, useDebounced } from '../lib/useApi';

export function InvoicesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | 'draft' | 'issued' | 'void'>('');
  const [paymentState, setPaymentState] = useState<'' | 'unpaid' | 'partial' | 'paid'>('');
  const [overdue, setOverdue] = useState(false);
  const [page, setPage] = useState(1);
  const query = useDebounced(search.trim(), 300);

  const params = new URLSearchParams({ page: String(page), pageSize: '10' });

  if (query !== '') params.set('q', query);
  if (status !== '') params.set('status', status);
  if (paymentState !== '') params.set('paymentState', paymentState);
  if (overdue) params.set('overdue', 'true');

  const { data, loading, error, reload } = useApi<Page<ApiInvoice>>(
    `/invoices?${params.toString()}`,
  );
  const filtered = query !== '' || status !== '' || paymentState !== '' || overdue;

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Drafts until you issue them. Issued invoices keep their number forever."
        actions={
          <LinkButton to="/invoices/new">
            <Plus aria-hidden="true" className="h-4 w-4" />
            New invoice
          </LinkButton>
        }
      />

      <Card flush>
        <div className="flex flex-wrap gap-3 border-b border-navy-900/10 p-4">
          <div className="relative min-w-56 flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
            />
            <Input
              aria-label="Search invoices"
              placeholder="Search invoice number or customer"
              className="pl-9"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            aria-label="Filter by status"
            className="w-36"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as typeof status);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="issued">Issued</option>
            <option value="void">Void</option>
          </Select>
          <Select
            aria-label="Filter by payment state"
            className="w-40"
            value={paymentState}
            onChange={(event) => {
              setPaymentState(event.target.value as typeof paymentState);
              setPage(1);
            }}
          >
            <option value="">Any payment</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Part paid</option>
            <option value="paid">Paid</option>
          </Select>
          <button
            type="button"
            aria-pressed={overdue}
            onClick={() => {
              setOverdue((value) => !value);
              setPage(1);
            }}
            className={`rounded-lg px-3 py-2 text-xs font-medium ring-1 ring-inset transition ${
              overdue
                ? 'bg-red-50 text-red-700 ring-red-200'
                : 'bg-white text-ink-muted ring-navy-900/15 hover:text-ink'
            }`}
          >
            Overdue only
          </button>
        </div>

        {loading && data === null && (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-10" />
            ))}
          </div>
        )}

        {error !== null && (
          <div className="p-5">
            <p className="text-sm text-red-700">{error.message}</p>
            <Button variant="secondary" className="mt-3" onClick={reload}>
              Try again
            </Button>
          </div>
        )}

        {data !== null && data.items.length === 0 && (
          <EmptyState
            icon={<FileText aria-hidden="true" className="h-5 w-5" />}
            title={filtered ? 'No invoices match' : 'No invoices yet'}
            description={
              filtered
                ? 'Clear a filter or try a different search.'
                : 'Create a draft, check the totals, then issue it.'
            }
            action={
              filtered ? undefined : <LinkButton to="/invoices/new">Create an invoice</LinkButton>
            }
          />
        )}

        {data !== null && data.items.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-mist text-xs uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Invoice
                    </th>
                    <th scope="col" className="hidden px-5 py-2.5 font-medium md:table-cell">
                      Date
                    </th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">
                      Total
                    </th>
                    <th
                      scope="col"
                      className="hidden px-5 py-2.5 text-right font-medium sm:table-cell"
                    >
                      Balance
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/5">
                  {data.items.map((invoice) => (
                    <tr
                      key={invoice.id}
                      onClick={() => {
                        navigate(`/invoices/${invoice.id}`);
                      }}
                      className="cursor-pointer transition hover:bg-mist"
                    >
                      <td className="px-5 py-3">
                        <Link
                          to={`/invoices/${invoice.id}`}
                          onClick={(event) => {
                            event.stopPropagation();
                          }}
                          className="font-medium text-brand-blue hover:underline"
                        >
                          {invoice.invoiceNumber ?? 'Draft'}
                        </Link>
                        <p className="text-xs text-ink-muted">{invoiceCustomerName(invoice)}</p>
                      </td>
                      <td className="hidden px-5 py-3 text-ink-muted md:table-cell">
                        {formatDate(invoice.invoiceDate)}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-ink">
                        {money(invoice.totals.totalMinor)}
                      </td>
                      <td className="hidden px-5 py-3 text-right tabular-nums sm:table-cell">
                        <span
                          className={
                            invoice.balanceDueMinor > 0 ? 'text-amber-700' : 'text-ink-muted'
                          }
                        >
                          {money(invoice.balanceDueMinor)}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <InvoiceStatusBadge
                          status={invoice.status}
                          paymentState={invoice.paymentState}
                          overdue={invoice.overdue}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              onChange={setPage}
            />
          </>
        )}
      </Card>
    </div>
  );
}
