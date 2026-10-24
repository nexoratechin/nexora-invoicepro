import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';

import { GST_SLABS_BP, GST_STATE_CODE_LIST, formatPaise } from '@nexora/shared';

import { PageHeader } from '../components/layout';
import { Alert, Button, Card, Field, Input, Select, Spinner, Textarea } from '../components/ui';
import { apiRequest, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { addDaysIso, money, percent, toQuantityInput, toRupeeInput, todayIso } from '../lib/format';
import {
  invoiceToPayload,
  previewTotals,
  type ApiCustomer,
  type ApiInvoice,
  type ApiProduct,
  type Page,
} from '../lib/invoice';
import { emptyLineItem, invoiceFormSchema, type InvoiceFormValues } from '../lib/validation';
import { useApi } from '../lib/useApi';
import { zodResolver } from '../lib/zod-resolver';

export function InvoiceEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const editing = id !== undefined;
  const navigate = useNavigate();
  const { session } = useAuth();
  const [failure, setFailure] = useState<string | null>(null);
  const [details, setDetails] = useState<string[]>([]);
  const [pending, setPending] = useState<'draft' | 'issue' | null>(null);

  const customers = useApi<Page<ApiCustomer>>('/customers?pageSize=100&status=active');
  const products = useApi<Page<ApiProduct>>('/products?pageSize=100&isActive=true');
  const existing = useApi<{ invoice: ApiInvoice }>(editing ? `/invoices/${String(id)}` : null);

  const today = todayIso();

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      customerId: searchParams.get('customerId') ?? '',
      invoiceDate: today,
      dueDate: addDaysIso(today, session?.settings?.defaultPaymentTermsDays ?? 15),
      placeOfSupplyStateCode: session?.business.stateCode ?? '24',
      notes: session?.settings?.defaultNotes ?? '',
      terms: '',
      lineItems: [emptyLineItem()],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' });

  useEffect(() => {
    if (existing.data === null) return;

    const invoice = existing.data.invoice;

    reset({
      customerId:
        typeof invoice.customerId === 'string'
          ? invoice.customerId
          : (invoice.customerId._id ?? invoice.customerId.id ?? ''),
      invoiceDate: invoice.invoiceDate.slice(0, 10),
      dueDate: invoice.dueDate.slice(0, 10),
      placeOfSupplyStateCode: invoice.placeOfSupplyStateCode,
      notes: invoice.notes,
      terms: invoice.terms,
      lineItems: invoice.lineItems.map((line) => ({
        productId: line.productId ?? '',
        description: line.description,
        hsnSac: line.hsnSac,
        unitLabel: line.unitLabel,
        quantity: toQuantityInput(line.quantityMilli),
        unitPrice: toRupeeInput(line.unitPriceMinor),
        discountPercent: String(line.discountBp / 100),
        taxRateBp: String(line.taxRateBp),
      })),
    });
  }, [existing.data, reset]);

  const watchedLines = watch('lineItems');
  const placeOfSupply = watch('placeOfSupplyStateCode');
  const invoiceDate = watch('invoiceDate');
  const totals = previewTotals(
    watchedLines ?? [],
    session?.business.stateCode ?? '24',
    placeOfSupply,
  );

  function applyProduct(index: number, productId: string): void {
    const product = products.data?.items.find((item) => item.id === productId);

    if (product === undefined) {
      setValue(`lineItems.${index}.productId`, productId);

      return;
    }

    setValue(`lineItems.${index}.productId`, product.id);
    setValue(`lineItems.${index}.description`, product.name);
    setValue(`lineItems.${index}.unitLabel`, product.unitLabel);
    setValue(`lineItems.${index}.unitPrice`, toRupeeInput(product.unitPriceMinor));
    setValue(`lineItems.${index}.taxRateBp`, String(product.taxRateBp));
  }

  const submit = (mode: 'draft' | 'issue') =>
    handleSubmit(async (values) => {
      setFailure(null);
      setDetails([]);
      setPending(mode);

      try {
        const payload = invoiceToPayload(values);
        let invoiceId = id;

        if (editing) {
          await apiRequest(`/invoices/${String(id)}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          });
        } else {
          const created = await apiRequest<{ invoice: ApiInvoice }>('/invoices', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          invoiceId = created.invoice.id;
        }

        if (mode === 'issue') {
          await apiRequest(`/invoices/${String(invoiceId)}/issue`, { method: 'POST', body: '{}' });
        }

        navigate(`/invoices/${String(invoiceId)}`);
      } catch (error) {
        setFailure(errorMessage(error));
        setDetails(
          Array.isArray((error as { details?: unknown }).details)
            ? (error as { details: { message?: string }[] }).details
                .map((detail) => detail.message)
                .filter((message): message is string => typeof message === 'string')
            : [],
        );
      } finally {
        setPending(null);
      }
    });

  if (editing && existing.loading && existing.data === null) {
    return <Spinner label="Loading the invoice" />;
  }

  if (editing && existing.data !== null && existing.data.invoice.status !== 'draft') {
    return (
      <div className="max-w-xl">
        <Alert tone="warning" title="This invoice is no longer a draft">
          Only drafts can be edited. Duplicate it if you need a new one.
        </Alert>
        <Button
          className="mt-4"
          onClick={() => {
            navigate(`/invoices/${String(id)}`);
          }}
        >
          Back to the invoice
        </Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={editing ? 'Edit draft' : 'New invoice'}
        description="Totals are recalculated on the server when you save. The preview uses the same maths."
        backTo={{ to: '/invoices', label: 'Invoices' }}
      />

      {failure !== null && (
        <div className="mb-4">
          <Alert tone="error" title="Could not save the invoice">
            {failure}
            {details.length > 0 && (
              <ul className="mt-1 list-inside list-disc">
                {details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            )}
          </Alert>
        </div>
      )}

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
          <div className="space-y-4">
            <Card title="Who and when">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Customer"
                  htmlFor="customerId"
                  error={errors.customerId?.message}
                  required
                  className="sm:col-span-2"
                >
                  <Select
                    id="customerId"
                    invalid={errors.customerId !== undefined}
                    {...register('customerId')}
                  >
                    <option value="">Choose a customer</option>
                    {(customers.data?.items ?? []).map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                        {customer.gstin === '' ? '' : ` · ${customer.gstin}`}
                      </option>
                    ))}
                  </Select>
                  {(customers.data?.items.length ?? 0) === 0 && (
                    <p className="mt-1.5 text-xs text-ink-muted">
                      No active customers yet. Add one from the Customers page first.
                    </p>
                  )}
                </Field>

                <Field
                  label="Invoice date"
                  htmlFor="invoiceDate"
                  error={errors.invoiceDate?.message}
                  required
                >
                  <Input
                    id="invoiceDate"
                    type="date"
                    invalid={errors.invoiceDate !== undefined}
                    {...register('invoiceDate')}
                  />
                </Field>

                <Field label="Due date" htmlFor="dueDate" error={errors.dueDate?.message} required>
                  <Input
                    id="dueDate"
                    type="date"
                    invalid={errors.dueDate !== undefined}
                    {...register('dueDate')}
                  />
                </Field>

                <Field
                  label="Place of supply"
                  htmlFor="placeOfSupplyStateCode"
                  error={errors.placeOfSupplyStateCode?.message}
                  hint={
                    totals?.taxTreatment === 'intra'
                      ? 'Same state: CGST and SGST at half the rate each.'
                      : 'Different state: the whole rate is IGST.'
                  }
                  className="sm:col-span-2"
                >
                  <Select id="placeOfSupplyStateCode" {...register('placeOfSupplyStateCode')}>
                    {GST_STATE_CODE_LIST.map((state) => (
                      <option key={state.code} value={state.code}>
                        {state.code} - {state.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </Card>

            <Card
              title="Line items"
              description="Pick a saved product or type the line yourself."
              actions={
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    append(emptyLineItem());
                  }}
                >
                  <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                  Add line
                </Button>
              }
            >
              <div className="space-y-3">
                {fields.map((field, index) => {
                  const lineErrors = errors.lineItems?.[index];
                  const line = watchedLines?.[index];
                  const lineTotal =
                    line === undefined
                      ? 0
                      : Math.round(
                          Number(line.unitPrice || '0') *
                            Number(line.quantity || '0') *
                            100 *
                            (1 - Number(line.discountPercent || '0') / 100) *
                            (1 + Number(line.taxRateBp) / 10_000),
                        );

                  return (
                    <div key={field.id} className="rounded-lg border border-navy-900/10 p-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field
                          label="Saved product"
                          htmlFor={`line-product-${String(index)}`}
                          className="sm:col-span-2"
                        >
                          <Select
                            id={`line-product-${String(index)}`}
                            value={line?.productId ?? ''}
                            onChange={(event) => {
                              applyProduct(index, event.target.value);
                            }}
                          >
                            <option value="">Custom line</option>
                            {(products.data?.items ?? []).map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.name} · {money(product.unitPriceMinor)}
                              </option>
                            ))}
                          </Select>
                        </Field>

                        <Field
                          label="Description"
                          htmlFor={`line-description-${String(index)}`}
                          error={lineErrors?.description?.message}
                          required
                          className="sm:col-span-2"
                        >
                          <Input
                            id={`line-description-${String(index)}`}
                            placeholder="Website redesign, 5 pages"
                            invalid={lineErrors?.description !== undefined}
                            {...register(`lineItems.${index}.description`)}
                          />
                        </Field>

                        <Field label="HSN / SAC" htmlFor={`line-hsn-${String(index)}`}>
                          <Input
                            id={`line-hsn-${String(index)}`}
                            placeholder="998314"
                            className="font-mono"
                            {...register(`lineItems.${index}.hsnSac`)}
                          />
                        </Field>

                        <Field label="Unit" htmlFor={`line-unit-${String(index)}`}>
                          <Input
                            id={`line-unit-${String(index)}`}
                            {...register(`lineItems.${index}.unitLabel`)}
                          />
                        </Field>

                        <Field
                          label="Quantity"
                          htmlFor={`line-qty-${String(index)}`}
                          error={lineErrors?.quantity?.message}
                        >
                          <Input
                            id={`line-qty-${String(index)}`}
                            inputMode="decimal"
                            invalid={lineErrors?.quantity !== undefined}
                            {...register(`lineItems.${index}.quantity`)}
                          />
                        </Field>

                        <Field
                          label="Unit price (INR)"
                          htmlFor={`line-price-${String(index)}`}
                          error={lineErrors?.unitPrice?.message}
                        >
                          <Input
                            id={`line-price-${String(index)}`}
                            inputMode="decimal"
                            invalid={lineErrors?.unitPrice !== undefined}
                            {...register(`lineItems.${index}.unitPrice`)}
                          />
                        </Field>

                        <Field
                          label="Discount (%)"
                          htmlFor={`line-discount-${String(index)}`}
                          error={lineErrors?.discountPercent?.message}
                        >
                          <Input
                            id={`line-discount-${String(index)}`}
                            inputMode="decimal"
                            invalid={lineErrors?.discountPercent !== undefined}
                            {...register(`lineItems.${index}.discountPercent`)}
                          />
                        </Field>

                        <Field label="GST rate" htmlFor={`line-tax-${String(index)}`}>
                          <Select
                            id={`line-tax-${String(index)}`}
                            {...register(`lineItems.${index}.taxRateBp`)}
                          >
                            {GST_SLABS_BP.map((slab) => (
                              <option key={slab} value={String(slab)}>
                                {percent(slab)}
                              </option>
                            ))}
                          </Select>
                        </Field>
                      </div>

                      <div className="mt-2 flex items-center justify-between border-t border-navy-900/5 pt-2">
                        <p className="text-xs text-ink-muted">Line total including tax</p>
                        <p className="text-sm font-medium tabular-nums text-ink">
                          {formatPaise(lineTotal)}
                        </p>
                      </div>

                      {fields.length > 1 && (
                        <div className="mt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              remove(index);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
                          >
                            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                            Remove line
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {errors.lineItems?.message !== undefined && (
                <p className="mt-3 text-xs text-red-600">{errors.lineItems.message}</p>
              )}
            </Card>

            <Card title="Notes and terms">
              <div className="grid gap-4">
                <Field label="Notes for the customer" htmlFor="notes" error={errors.notes?.message}>
                  <Textarea
                    id="notes"
                    rows={3}
                    placeholder="Thank you for your business."
                    {...register('notes')}
                  />
                </Field>
                <Field label="Payment terms" htmlFor="terms" error={errors.terms?.message}>
                  <Textarea
                    id="terms"
                    rows={2}
                    placeholder="Payment within 15 days."
                    {...register('terms')}
                  />
                </Field>
              </div>
            </Card>
          </div>

          <div className="lg:sticky lg:top-20">
            <Card title="Summary">
              {totals === null ? (
                <p className="text-sm text-ink-muted">Fill in a valid line to see the totals.</p>
              ) : (
                <dl className="space-y-2 text-sm">
                  <Row label="Subtotal" value={formatPaise(totals.totals.subtotalMinor)} />
                  <Row
                    label="Discount"
                    value={`-${formatPaise(totals.totals.discountTotalMinor)}`}
                  />
                  <Row label="Taxable value" value={formatPaise(totals.totals.taxableTotalMinor)} />
                  {totals.taxTreatment === 'intra' ? (
                    <>
                      <Row label="CGST" value={formatPaise(totals.totals.cgstTotalMinor)} />
                      <Row label="SGST" value={formatPaise(totals.totals.sgstTotalMinor)} />
                    </>
                  ) : (
                    <Row label="IGST" value={formatPaise(totals.totals.igstTotalMinor)} />
                  )}
                  <div className="flex items-baseline justify-between border-t border-navy-900/10 pt-2">
                    <dt className="font-medium text-ink">Total</dt>
                    <dd className="text-lg font-semibold tabular-nums text-ink">
                      {formatPaise(totals.totals.totalMinor)}
                    </dd>
                  </div>
                </dl>
              )}

              <div className="mt-5 space-y-2">
                <Button
                  className="w-full"
                  disabled={pending !== null || fields.length === 0}
                  loading={pending === 'issue'}
                  onClick={() => {
                    void submit('issue')();
                  }}
                >
                  {editing ? 'Save and issue' : 'Issue invoice'}
                </Button>
                <Button
                  className="w-full"
                  variant="secondary"
                  disabled={pending !== null || fields.length === 0}
                  loading={pending === 'draft'}
                  onClick={() => {
                    void submit('draft')();
                  }}
                >
                  Save as draft
                </Button>
              </div>

              <p className="mt-3 text-xs text-ink-muted">
                Issuing assigns the next number in your series. A draft does not use a number.
              </p>
            </Card>

            {invoiceDate !== '' && (
              <p className="mt-3 px-1 text-xs text-ink-muted">
                Fiscal year follows the issue date. Rates and totals are stored on the invoice.
              </p>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="tabular-nums text-ink">{value}</dd>
    </div>
  );
}
