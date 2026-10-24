import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Ban, Copy, Download, FileText, Pencil, Plus, Send, Trash2, Wallet } from 'lucide-react';

import { GST_STATE_CODES, PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from '@nexora/shared';

import { PageHeader } from '../components/layout';
import { InvoiceStatusBadge } from '../components/StatusBadge';
import {
  Alert,
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Field,
  Input,
  LinkButton,
  Select,
  Skeleton,
  Textarea,
} from '../components/ui';
import { apiRequest, downloadInvoicePdf, errorMessage } from '../lib/api';
import { useCanManage } from '../lib/auth';
import { formatDate, formatDateTime, money, percent, toRupeeInput, todayIso } from '../lib/format';
import type { ApiCustomer, ApiInvoice, ApiPayment } from '../lib/invoice';
import { paymentFormSchema, type PaymentFormValues } from '../lib/validation';
import { useApi } from '../lib/useApi';
import { zodResolver } from '../lib/zod-resolver';

interface InvoiceDetail {
  invoice: ApiInvoice;
  customer: ApiCustomer | null;
  payments: ApiPayment[];
}

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const canManage = useCanManage();
  const { data, loading, error, reload } = useApi<InvoiceDetail>(`/invoices/${String(id)}`);

  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);

  if (loading && data === null) {
    return <Skeleton className="h-64 rounded-xl" />;
  }

  if (error !== null) {
    return (
      <Card title="Invoice could not load">
        <p className="text-sm text-ink-muted">{error.message}</p>
        <LinkButton to="/invoices" variant="secondary">
          Back to invoices
        </LinkButton>
      </Card>
    );
  }

  if (data === null) {
    return null;
  }

  const { invoice, customer, payments } = data;
  const activePayments = payments.filter((payment) => payment.status === 'active');

  async function act(path: string, body: unknown, key: string): Promise<void> {
    setBusy(key);
    setFailure(null);

    try {
      await apiRequest(`/invoices/${invoice.id}${path}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      reload();
    } catch (cause) {
      setFailure(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  }

  async function duplicate(): Promise<void> {
    setBusy('duplicate');
    setFailure(null);

    try {
      const created = await apiRequest<{ invoice: ApiInvoice }>(
        `/invoices/${invoice.id}/duplicate`,
        { method: 'POST', body: '{}' },
      );
      navigate(`/invoices/${created.invoice.id}`);
    } catch (cause) {
      setFailure(errorMessage(cause));
      setBusy(null);
    }
  }

  async function savePdf(): Promise<void> {
    setPdfBusy(true);
    setFailure(null);

    try {
      const name = (invoice.invoiceNumber ?? 'draft-invoice').replace(/[^A-Za-z0-9._-]+/g, '-');
      await downloadInvoicePdf(invoice.id, `${name}.pdf`);
    } catch (cause) {
      setFailure(errorMessage(cause));
    } finally {
      setPdfBusy(false);
    }
  }

  async function voidPayment(paymentId: string): Promise<void> {
    setBusy(paymentId);
    setFailure(null);

    try {
      await apiRequest(`/payments/${paymentId}/void`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Voided from the invoice screen' }),
      });
      reload();
    } catch (cause) {
      setFailure(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        title={invoice.invoiceNumber ?? 'Draft invoice'}
        description={`${
          invoice.status === 'draft' ? 'Not issued yet' : `Issued ${formatDate(invoice.issuedAt)}`
        } · ${invoice.customerSnapshot?.name ?? customer?.name ?? 'Customer'}`}
        backTo={{ to: '/invoices', label: 'Invoices' }}
        actions={
          <>
            <InvoiceStatusBadge
              status={invoice.status}
              paymentState={invoice.paymentState}
              overdue={invoice.overdue}
            />
            {invoice.status === 'draft' && (
              <>
                <LinkButton to={`/invoices/${invoice.id}/edit`} variant="secondary">
                  <Pencil aria-hidden="true" className="h-4 w-4" />
                  Edit
                </LinkButton>
                <Button
                  loading={busy === 'issue'}
                  onClick={() => {
                    void act('/issue', {}, 'issue');
                  }}
                >
                  <Send aria-hidden="true" className="h-4 w-4" />
                  Issue
                </Button>
              </>
            )}
            {invoice.status === 'issued' && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setPaymentOpen(true);
                  }}
                  disabled={invoice.balanceDueMinor === 0}
                >
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  Record payment
                </Button>
                <Button
                  variant="secondary"
                  loading={busy === 'duplicate'}
                  onClick={() => {
                    void duplicate();
                  }}
                >
                  <Copy aria-hidden="true" className="h-4 w-4" />
                  Duplicate
                </Button>
                <Button
                  variant="ghost"
                  loading={pdfBusy}
                  onClick={() => {
                    void savePdf();
                  }}
                >
                  <Download aria-hidden="true" className="h-4 w-4" />
                  PDF
                </Button>
                {canManage && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setVoidOpen(true);
                    }}
                  >
                    <Ban aria-hidden="true" className="h-4 w-4" />
                    Void
                  </Button>
                )}
              </>
            )}
          </>
        }
      />

      {failure !== null && (
        <div className="mb-4">
          <Alert tone="error">{failure}</Alert>
        </div>
      )}

      {invoice.status === 'void' && (
        <div className="mb-4">
          <Alert tone="warning" title="This invoice is void">
            {invoice.voidReason ?? 'No reason recorded.'} It stays in the list but not in revenue.
          </Alert>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Details" className="lg:col-span-1">
          <dl className="space-y-3 text-sm">
            <Row label="Invoice date">{formatDate(invoice.invoiceDate)}</Row>
            <Row label="Due date">{formatDate(invoice.dueDate)}</Row>
            <Row label="Place of supply">
              {GST_STATE_CODES[invoice.placeOfSupplyStateCode as keyof typeof GST_STATE_CODES] ??
                invoice.placeOfSupplyStateCode}
            </Row>
            <Row label="Tax treatment">
              <Badge tone={invoice.taxTreatment === 'intra' ? 'blue' : 'violet'}>
                {invoice.taxTreatment === 'intra' ? 'CGST + SGST' : 'IGST'}
              </Badge>
            </Row>
            <Row label="Customer">
              {customer === null ? (
                'Deleted customer'
              ) : (
                <Link
                  to={`/customers/${customer.id}`}
                  className="font-medium text-brand-blue hover:underline"
                >
                  {customer.name}
                </Link>
              )}
            </Row>
            {invoice.issuedAt !== null && (
              <Row label="Issued">{formatDateTime(invoice.issuedAt)}</Row>
            )}
          </dl>
        </Card>

        <Card title="Summary" className="lg:col-span-2">
          <dl className="space-y-2 text-sm">
            <Row label="Subtotal">{money(invoice.totals.subtotalMinor)}</Row>
            <Row label="Discount">{money(invoice.totals.discountTotalMinor)}</Row>
            <Row label="Taxable value">{money(invoice.totals.taxableTotalMinor)}</Row>
            {invoice.taxTreatment === 'intra' ? (
              <>
                <Row label="CGST">{money(invoice.totals.cgstTotalMinor)}</Row>
                <Row label="SGST">{money(invoice.totals.sgstTotalMinor)}</Row>
              </>
            ) : (
              <Row label="IGST">{money(invoice.totals.igstTotalMinor)}</Row>
            )}
            <div className="flex items-baseline justify-between border-t border-navy-900/10 pt-2">
              <dt className="font-medium text-ink">Total</dt>
              <dd className="text-lg font-semibold tabular-nums text-ink">
                {money(invoice.totals.totalMinor)}
              </dd>
            </div>
            <Row label="Paid">{money(invoice.amountPaidMinor)}</Row>
            <div className="flex items-baseline justify-between">
              <dt className="font-medium text-ink">Balance due</dt>
              <dd
                className={`text-lg font-semibold tabular-nums ${
                  invoice.balanceDueMinor > 0 ? 'text-amber-700' : 'text-emerald-700'
                }`}
              >
                {money(invoice.balanceDueMinor)}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card title="Items" className="mt-4" flush>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-mist text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th scope="col" className="px-5 py-2.5 font-medium">
                  Description
                </th>
                <th scope="col" className="hidden px-5 py-2.5 text-right font-medium sm:table-cell">
                  Qty
                </th>
                <th scope="col" className="hidden px-5 py-2.5 text-right font-medium md:table-cell">
                  Rate
                </th>
                <th scope="col" className="hidden px-5 py-2.5 text-right font-medium md:table-cell">
                  GST
                </th>
                <th scope="col" className="px-5 py-2.5 text-right font-medium">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-900/5">
              {invoice.lineItems.map((line) => (
                <tr key={line.lineNo}>
                  <td className="px-5 py-3">
                    <p className="text-ink">{line.description}</p>
                    <p className="text-xs text-ink-muted">
                      {line.hsnSac === '' ? 'No HSN' : `HSN ${line.hsnSac}`} · per {line.unitLabel}
                      {line.discountMinor > 0 ? ` · discount ${money(line.discountMinor)}` : ''}
                    </p>
                  </td>
                  <td className="hidden px-5 py-3 text-right tabular-nums text-ink-muted sm:table-cell">
                    {line.quantityMilli / 1000}
                  </td>
                  <td className="hidden px-5 py-3 text-right tabular-nums text-ink md:table-cell">
                    {money(line.unitPriceMinor)}
                  </td>
                  <td className="hidden px-5 py-3 text-right text-ink-muted md:table-cell">
                    {percent(line.taxRateBp)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-ink">
                    {money(line.lineTotalMinor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card
          title="Payments"
          description={
            activePayments.length === 0
              ? 'Nothing recorded yet.'
              : `${activePayments.length} active payment${activePayments.length === 1 ? '' : 's'}`
          }
          actions={
            invoice.status === 'issued' && invoice.balanceDueMinor > 0 ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setPaymentOpen(true);
                }}
              >
                <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                Add
              </Button>
            ) : undefined
          }
          flush
        >
          {payments.length === 0 ? (
            <EmptyState
              icon={<Wallet aria-hidden="true" className="h-5 w-5" />}
              title="No payments"
              description="Record a full or part payment and the balance updates here."
            />
          ) : (
            <ul className="divide-y divide-navy-900/5">
              {payments.map((payment) => (
                <li key={payment.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm ${payment.status === 'void' ? 'text-ink-muted line-through' : 'text-ink'}`}
                    >
                      {money(payment.amountMinor)} · {PAYMENT_METHOD_LABELS[payment.method]}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {formatDate(payment.paidAt)}
                      {payment.reference === '' ? '' : ` · ${payment.reference}`}
                      {payment.status === 'void' ? ' · void' : ''}
                    </p>
                  </div>
                  {payment.status === 'active' && canManage && (
                    <button
                      type="button"
                      aria-label="Void this payment"
                      disabled={busy === payment.id}
                      onClick={() => {
                        void voidPayment(payment.id);
                      }}
                      className="rounded-lg p-1.5 text-ink-muted transition hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="History" flush>
          {(invoice.events ?? []).length === 0 ? (
            <EmptyState
              icon={<FileText aria-hidden="true" className="h-5 w-5" />}
              title="No history yet"
              description="Issuing, voiding and payments all appear here."
            />
          ) : (
            <ol className="space-y-3 p-5">
              {(invoice.events ?? [])
                .slice()
                .reverse()
                .map((event, index) => (
                  <li key={`${event.createdAt}-${String(index)}`} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-cyan"
                    />
                    <div>
                      <p className="text-sm text-ink">{event.message}</p>
                      <p className="text-xs text-ink-muted">{formatDateTime(event.createdAt)}</p>
                    </div>
                  </li>
                ))}
            </ol>
          )}
        </Card>
      </div>

      <PaymentDialog
        open={paymentOpen}
        onClose={() => {
          setPaymentOpen(false);
        }}
        invoiceId={invoice.id}
        balanceDueMinor={invoice.balanceDueMinor}
        onSaved={() => {
          setPaymentOpen(false);
          reload();
        }}
      />

      <Dialog
        open={voidOpen}
        onClose={() => {
          setVoidOpen(false);
        }}
        title="Void this invoice?"
        description="The number stays used. The invoice stays in the list and drops out of revenue."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setVoidOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy === 'void'}
              disabled={voidReason.trim().length < 3}
              onClick={() => {
                void act('/void', { reason: voidReason.trim() }, 'void').then(() => {
                  setVoidOpen(false);
                  setVoidReason('');
                });
              }}
            >
              Void invoice
            </Button>
          </>
        }
      >
        <Field
          label="Reason"
          htmlFor="voidReason"
          hint="At least three characters. Stored on the invoice."
        >
          <Textarea
            id="voidReason"
            rows={3}
            value={voidReason}
            onChange={(event) => {
              setVoidReason(event.target.value);
            }}
            placeholder="Raised against the wrong customer"
          />
        </Field>
      </Dialog>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right tabular-nums text-ink">{children}</dd>
    </div>
  );
}

function PaymentDialog({
  open,
  onClose,
  invoiceId,
  balanceDueMinor,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  invoiceId: string;
  balanceDueMinor: number;
  onSaved: () => void;
}) {
  const [failure, setFailure] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      amount: toRupeeInput(balanceDueMinor),
      paidAt: todayIso(),
      method: 'upi',
      reference: '',
      note: '',
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        amount: toRupeeInput(balanceDueMinor),
        paidAt: todayIso(),
        method: 'upi',
        reference: '',
        note: '',
      });
      setFailure(null);
    }
  }, [open, balanceDueMinor, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null);

    try {
      await apiRequest(`/invoices/${invoiceId}/payments`, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({
          amountMinor: Math.round(Number(values.amount) * 100),
          paidAt: values.paidAt,
          method: values.method,
          reference: values.reference,
          note: values.note,
        }),
      });
      onSaved();
    } catch (error) {
      setFailure(errorMessage(error));
    }
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Record a payment"
      description={`Balance due ${money(balanceDueMinor)}. Part payments are fine.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={isSubmitting}
            onClick={() => {
              void onSubmit();
            }}
          >
            Save payment
          </Button>
        </>
      }
    >
      {failure !== null && (
        <div className="mb-3">
          <Alert tone="error">{failure}</Alert>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Amount (INR)" htmlFor="amount" error={errors.amount?.message} required>
          <Input
            id="amount"
            inputMode="decimal"
            invalid={errors.amount !== undefined}
            {...register('amount')}
          />
        </Field>
        <Field label="Paid on" htmlFor="paidAt" error={errors.paidAt?.message} required>
          <Input
            id="paidAt"
            type="date"
            invalid={errors.paidAt !== undefined}
            {...register('paidAt')}
          />
        </Field>
        <Field label="Method" htmlFor="method" error={errors.method?.message} required>
          <Select id="method" {...register('method')}>
            {PAYMENT_METHODS.map((method) => (
              <option key={method} value={method}>
                {PAYMENT_METHOD_LABELS[method]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Reference" htmlFor="reference" hint="UTR, cheque number, UPI reference.">
          <Input id="reference" placeholder="UPI/4123/8891" {...register('reference')} />
        </Field>
        <Field label="Note" htmlFor="note" className="sm:col-span-2">
          <Input id="note" placeholder="Advance" {...register('note')} />
        </Field>
      </div>
    </Dialog>
  );
}
