import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet } from 'lucide-react';

import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from '@nexora/shared';

import { PageHeader } from '../components/layout';
import {
  Alert,
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Field,
  Pagination,
  Select,
  Skeleton,
  Textarea,
} from '../components/ui';
import { apiRequest, errorMessage } from '../lib/api';
import { useCanManage } from '../lib/auth';
import { formatDate, money } from '../lib/format';
import { paymentInvoiceNumber, type ApiPayment, type Page } from '../lib/invoice';
import { useApi } from '../lib/useApi';

export function PaymentsPage() {
  const canManage = useCanManage();
  const [method, setMethod] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [failure, setFailure] = useState<string | null>(null);
  const [voiding, setVoiding] = useState<ApiPayment | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const params = new URLSearchParams({ page: String(page), pageSize: '15' });

  if (method !== '') params.set('method', method);
  if (status !== '') params.set('status', status);

  const { data, loading, error, reload } = useApi<Page<ApiPayment>>(
    `/payments?${params.toString()}`,
  );

  async function submitVoid(): Promise<void> {
    if (voiding === null) return;

    setBusy(true);
    setFailure(null);

    try {
      await apiRequest(`/payments/${voiding.id}/void`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() }),
      });
      setVoiding(null);
      setReason('');
      reload();
    } catch (cause) {
      setFailure(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  const active = (data?.items ?? []).filter((payment) => payment.status === 'active');
  const total = active.reduce((sum, payment) => sum + payment.amountMinor, 0);

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Everything recorded against invoices. Voiding restores the invoice balance."
      />

      {failure !== null && (
        <div className="mb-4">
          <Alert tone="error">{failure}</Alert>
        </div>
      )}

      <Card flush>
        <div className="flex flex-wrap items-center gap-3 border-b border-navy-900/10 p-4">
          <Select
            aria-label="Filter by method"
            className="w-44"
            value={method}
            onChange={(event) => {
              setMethod(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Any method</option>
            {PAYMENT_METHODS.map((option) => (
              <option key={option} value={option}>
                {PAYMENT_METHOD_LABELS[option]}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter by status"
            className="w-36"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="void">Void</option>
          </Select>
          <p className="ml-auto text-xs text-ink-muted">
            {data === null
              ? 'Loading'
              : `${String(active.length)} active on this page · ${money(total)}`}
          </p>
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
            icon={<Wallet aria-hidden="true" className="h-5 w-5" />}
            title="No payments recorded"
            description="Open an issued invoice and record a payment against it."
          />
        )}

        {data !== null && data.items.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-mist text-xs uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Amount
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Invoice
                    </th>
                    <th scope="col" className="hidden px-5 py-2.5 font-medium sm:table-cell">
                      Date
                    </th>
                    <th scope="col" className="hidden px-5 py-2.5 font-medium md:table-cell">
                      Method
                    </th>
                    <th scope="col" className="hidden px-5 py-2.5 font-medium lg:table-cell">
                      Reference
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Status
                    </th>
                    {canManage && (
                      <th scope="col" className="px-5 py-2.5 text-right font-medium">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/5">
                  {data.items.map((payment) => {
                    const invoiceRef =
                      typeof payment.invoiceId === 'string'
                        ? payment.invoiceId
                        : payment.invoiceId.id;

                    return (
                      <tr key={payment.id} className="transition hover:bg-mist">
                        <td className="px-5 py-3 font-medium tabular-nums text-ink">
                          {money(payment.amountMinor)}
                        </td>
                        <td className="px-5 py-3">
                          {typeof invoiceRef === 'string' ? (
                            <Link
                              to={`/invoices/${invoiceRef}`}
                              className="text-brand-blue hover:underline"
                            >
                              {paymentInvoiceNumber(payment)}
                            </Link>
                          ) : (
                            paymentInvoiceNumber(payment)
                          )}
                        </td>
                        <td className="hidden px-5 py-3 text-ink-muted sm:table-cell">
                          {formatDate(payment.paidAt)}
                        </td>
                        <td className="hidden px-5 py-3 text-ink-muted md:table-cell">
                          {PAYMENT_METHOD_LABELS[payment.method]}
                        </td>
                        <td className="hidden px-5 py-3 font-mono text-xs text-ink-muted lg:table-cell">
                          {payment.reference === '' ? '-' : payment.reference}
                        </td>
                        <td className="px-5 py-3">
                          <Badge tone={payment.status === 'active' ? 'green' : 'neutral'}>
                            {payment.status === 'active' ? 'Active' : 'Void'}
                          </Badge>
                        </td>
                        {canManage && (
                          <td className="px-5 py-3 text-right">
                            {payment.status === 'active' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setVoiding(payment);
                                  setReason('');
                                }}
                                className="text-xs font-medium text-red-600 hover:underline"
                              >
                                Void
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
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

      <Dialog
        open={voiding !== null}
        onClose={() => {
          setVoiding(null);
        }}
        title="Void this payment?"
        description={
          voiding === null
            ? ''
            : `${money(voiding.amountMinor)} on ${formatDate(voiding.paidAt)} will be reversed and the invoice balance restored.`
        }
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setVoiding(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy}
              disabled={reason.trim().length < 3}
              onClick={() => {
                void submitVoid();
              }}
            >
              Void payment
            </Button>
          </>
        }
      >
        <Field label="Reason" htmlFor="void-reason" hint="At least three characters.">
          <Textarea
            id="void-reason"
            rows={3}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
            }}
            placeholder="Cheque bounced"
          />
        </Field>
      </Dialog>
    </div>
  );
}
