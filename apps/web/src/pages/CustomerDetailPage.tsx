import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Archive, FileText, Pencil, RotateCcw, Trash2 } from 'lucide-react';

import { PageHeader } from '../components/layout';
import { InvoiceStatusBadge } from '../components/StatusBadge';
import {
  Alert,
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  LinkButton,
  Skeleton,
} from '../components/ui';
import { ApiError, apiRequest, errorMessage } from '../lib/api';
import { useCanManage } from '../lib/auth';
import { formatDate, money } from '../lib/format';
import { invoiceCustomerName, type ApiCustomer, type ApiInvoice, type Page } from '../lib/invoice';
import { useApi } from '../lib/useApi';

interface CustomerDetail {
  customer: ApiCustomer;
  stats: {
    totalBilledMinor: number;
    totalPaidMinor: number;
    outstandingMinor: number;
    invoiceCount: number;
    lastInvoiceAt: string | null;
  };
}

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const canManage = useCanManage();
  const [failure, setFailure] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const detail = useApi<CustomerDetail>(`/customers/${String(id)}`);
  const invoices = useApi<Page<ApiInvoice>>(`/invoices?customerId=${String(id)}&pageSize=10`);

  if (detail.loading && detail.data === null) {
    return <Skeleton className="h-40 rounded-xl" />;
  }

  if (detail.error !== null) {
    return (
      <Card title="Customer could not load">
        <p className="text-sm text-ink-muted">{detail.error.message}</p>
        <LinkButton to="/customers" variant="secondary">
          Back to customers
        </LinkButton>
      </Card>
    );
  }

  if (detail.data === null) {
    return null;
  }

  const { customer, stats } = detail.data;
  const archived = customer.status === 'archived';

  async function toggleArchive(): Promise<void> {
    setFailure(null);

    try {
      await apiRequest(`/customers/${customer.id}/${archived ? 'restore' : 'archive'}`, {
        method: 'POST',
        body: '{}',
      });
      detail.reload();
    } catch (error) {
      setFailure(errorMessage(error));
    }
  }

  async function remove(): Promise<void> {
    setDeleting(true);
    setFailure(null);

    try {
      await apiRequest(`/customers/${customer.id}`, { method: 'DELETE' });
      navigate('/customers');
    } catch (error) {
      setFailure(
        error instanceof ApiError && error.code === 'CUSTOMER_HAS_INVOICES'
          ? 'This customer has invoices, so it cannot be deleted. Archive it instead.'
          : errorMessage(error),
      );
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={customer.name}
        description={customer.email === '' ? 'No email on file' : customer.email}
        backTo={{ to: '/customers', label: 'Customers' }}
        actions={
          <>
            <LinkButton to={`/invoices/new?customerId=${customer.id}`} variant="secondary">
              <FileText aria-hidden="true" className="h-4 w-4" />
              New invoice
            </LinkButton>
            <LinkButton to={`/customers/${customer.id}/edit`} variant="secondary">
              <Pencil aria-hidden="true" className="h-4 w-4" />
              Edit
            </LinkButton>
            {canManage && (
              <Button
                variant="secondary"
                onClick={() => {
                  void toggleArchive();
                }}
              >
                {archived ? (
                  <>
                    <RotateCcw aria-hidden="true" className="h-4 w-4" /> Restore
                  </>
                ) : (
                  <>
                    <Archive aria-hidden="true" className="h-4 w-4" /> Archive
                  </>
                )}
              </Button>
            )}
            {canManage && (
              <Button
                variant="ghost"
                onClick={() => {
                  setConfirmDelete(true);
                }}
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
                Delete
              </Button>
            )}
          </>
        }
      />

      {archived && (
        <div className="mb-4">
          <Alert tone="warning" title="This customer is archived">
            Archived customers cannot be added to new invoices.
          </Alert>
        </div>
      )}

      {failure !== null && (
        <div className="mb-4">
          <Alert tone="error">{failure}</Alert>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Billing details" className="lg:col-span-1">
          <dl className="space-y-3 text-sm">
            <Row label="Status">
              <Badge tone={archived ? 'neutral' : 'green'}>
                {archived ? 'Archived' : 'Active'}
              </Badge>
            </Row>
            <Row label="Phone">{customer.phone === '' ? '-' : customer.phone}</Row>
            <Row label="GSTIN">
              <span className="font-mono text-xs">
                {customer.gstin === '' ? '-' : customer.gstin}
              </span>
            </Row>
            <Row label="State">
              {customer.stateCode === '' ? 'Business default' : customer.stateCode}
            </Row>
            <Row label="Address">
              <span className="text-right">
                {[
                  customer.billingAddress.line1,
                  customer.billingAddress.line2,
                  customer.billingAddress.city,
                  customer.billingAddress.state,
                  customer.billingAddress.pincode,
                ]
                  .filter((part) => part !== '')
                  .join(', ') || '-'}
              </span>
            </Row>
            {customer.notes !== '' && (
              <Row label="Notes">
                <span className="text-right text-ink-muted">{customer.notes}</span>
              </Row>
            )}
          </dl>
        </Card>

        <Card title="Lifetime value" className="lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Metric label="Billed" value={money(stats.totalBilledMinor)} />
            <Metric label="Paid" value={money(stats.totalPaidMinor)} />
            <Metric label="Outstanding" value={money(stats.outstandingMinor)} tone="amber" />
            <Metric
              label="Invoices"
              value={String(stats.invoiceCount)}
              hint={
                stats.lastInvoiceAt === null
                  ? 'No invoices yet'
                  : `Last ${formatDate(stats.lastInvoiceAt)}`
              }
            />
          </div>
        </Card>
      </div>

      <Card
        title="Invoice history"
        className="mt-4"
        description="Issued invoices keep the address and GSTIN they were raised with."
        flush
      >
        {invoices.loading && invoices.data === null && (
          <div className="space-y-2 p-5">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        )}

        {invoices.data !== null && invoices.data.items.length === 0 && (
          <EmptyState
            icon={<FileText aria-hidden="true" className="h-5 w-5" />}
            title="No invoices for this customer"
            description="Raise the first one and it will appear here."
            action={
              <LinkButton to={`/invoices/new?customerId=${customer.id}`}>
                Create an invoice
              </LinkButton>
            }
          />
        )}

        {invoices.data !== null && invoices.data.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-mist text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Invoice
                  </th>
                  <th scope="col" className="hidden px-5 py-2.5 font-medium sm:table-cell">
                    Date
                  </th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">
                    Total
                  </th>
                  <th
                    scope="col"
                    className="hidden px-5 py-2.5 text-right font-medium sm:table-cell"
                  >
                    Due
                  </th>
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-900/5">
                {invoices.data.items.map((invoice) => (
                  <tr key={invoice.id} className="transition hover:bg-mist">
                    <td className="px-5 py-3">
                      <Link
                        to={`/invoices/${invoice.id}`}
                        className="font-medium text-brand-blue hover:underline"
                      >
                        {invoice.invoiceNumber ?? 'Draft'}
                      </Link>
                      <p className="text-xs text-ink-muted">{invoiceCustomerName(invoice)}</p>
                    </td>
                    <td className="hidden px-5 py-3 text-ink-muted sm:table-cell">
                      {formatDate(invoice.invoiceDate)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-ink">
                      {money(invoice.totals.totalMinor)}
                    </td>
                    <td className="hidden px-5 py-3 text-right tabular-nums text-ink-muted sm:table-cell">
                      {money(invoice.balanceDueMinor)}
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
        )}
      </Card>

      <Dialog
        open={confirmDelete}
        onClose={() => {
          setConfirmDelete(false);
        }}
        title="Delete this customer?"
        description="This cannot be undone. Customers with invoices must be archived instead."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setConfirmDelete(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleting}
              onClick={() => {
                void remove();
              }}
            >
              Delete customer
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          {customer.name} will be removed from your customer list.
        </p>
      </Dialog>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right text-ink">{children}</dd>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone = 'ink',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'ink' | 'amber';
}) {
  return (
    <div className="rounded-lg border border-navy-900/10 p-3">
      <p className="text-xs text-ink-muted">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold tabular-nums ${tone === 'amber' ? 'text-amber-700' : 'text-ink'}`}
      >
        {value}
      </p>
      {hint !== undefined && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
