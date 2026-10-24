import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';

import { GST_SLABS_BP, formatPaise } from '@nexora/shared';

import { PageHeader } from '../components/layout';
import { Alert, Button, Card, Field, Input, Select, Spinner, Textarea } from '../components/ui';
import { apiRequest, errorMessage } from '../lib/api';
import { toRupeeInput } from '../lib/format';
import type { ApiProduct } from '../lib/invoice';
import { productFormSchema, type ProductFormValues } from '../lib/validation';
import { useApi } from '../lib/useApi';
import { zodResolver } from '../lib/zod-resolver';

const emptyValues: ProductFormValues = {
  name: '',
  description: '',
  sku: '',
  unitLabel: 'unit',
  unitPrice: '0.00',
  taxRateBp: '1800',
  isActive: true,
};

export function ProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const editing = id !== undefined;
  const navigate = useNavigate();
  const [failure, setFailure] = useState<string | null>(null);

  const { data, loading } = useApi<{ product: ApiProduct }>(
    editing ? `/products/${String(id)}` : null,
  );

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (data === null) return;

    const product = data.product;

    reset({
      name: product.name,
      description: product.description,
      sku: product.sku ?? '',
      unitLabel: product.unitLabel,
      unitPrice: toRupeeInput(product.unitPriceMinor),
      taxRateBp: String(product.taxRateBp),
      isActive: product.isActive,
    });
  }, [data, reset]);

  const price = watch('unitPrice');
  const taxRate = watch('taxRateBp');

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null);

    const payload = {
      name: values.name,
      description: values.description,
      sku: values.sku,
      unitLabel: values.unitLabel,
      unitPriceMinor: Math.round(Number(values.unitPrice) * 100),
      taxRateBp: Number(values.taxRateBp),
      isActive: values.isActive,
    };

    try {
      if (editing) {
        await apiRequest(`/products/${String(id)}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/products', { method: 'POST', body: JSON.stringify(payload) });
      }
      navigate('/products');
    } catch (error) {
      setFailure(errorMessage(error));
    }
  });

  if (editing && loading && data === null) {
    return <Spinner label="Loading the product" />;
  }

  const previewPaise = /^\d+(\.\d{1,2})?$/.test(price) ? Math.round(Number(price) * 100) : 0;
  const previewTax = Math.round((previewPaise * Number(taxRate)) / 10_000);

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={editing ? 'Edit product' : 'New product'}
        description="A reusable line item. Picking it on an invoice copies these values into the line."
        backTo={{ to: '/products', label: 'Products' }}
      />

      {failure !== null && (
        <div className="mb-4">
          <Alert tone="error" title="Could not save the product">
            {failure}
          </Alert>
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Name"
              htmlFor="name"
              error={errors.name?.message}
              required
              className="sm:col-span-2"
            >
              <Input
                id="name"
                placeholder="Website redesign"
                invalid={errors.name !== undefined}
                {...register('name')}
              />
            </Field>

            <Field
              label="Description"
              htmlFor="description"
              error={errors.description?.message}
              className="sm:col-span-2"
            >
              <Textarea
                id="description"
                rows={2}
                placeholder="Five page marketing site"
                {...register('description')}
              />
            </Field>

            <Field
              label="SKU"
              htmlFor="sku"
              error={errors.sku?.message}
              hint="Optional, unique per business."
            >
              <Input
                id="sku"
                placeholder="WEB-001"
                className="font-mono uppercase"
                {...register('sku')}
              />
            </Field>

            <Field
              label="Unit"
              htmlFor="unitLabel"
              error={errors.unitLabel?.message}
              hint="hour, piece, month, project"
            >
              <Input
                id="unitLabel"
                placeholder="project"
                invalid={errors.unitLabel !== undefined}
                {...register('unitLabel')}
              />
            </Field>

            <Field
              label="Unit price (INR)"
              htmlFor="unitPrice"
              error={errors.unitPrice?.message}
              required
            >
              <Input
                id="unitPrice"
                inputMode="decimal"
                placeholder="25000.00"
                invalid={errors.unitPrice !== undefined}
                {...register('unitPrice')}
              />
            </Field>

            <Field label="GST rate" htmlFor="taxRateBp" error={errors.taxRateBp?.message} required>
              <Select id="taxRateBp" {...register('taxRateBp')}>
                {GST_SLABS_BP.map((slab) => (
                  <option key={slab} value={String(slab)}>
                    {slab / 100}%
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="mt-4 rounded-lg bg-mist p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-muted">Taxable value</span>
              <span className="tabular-nums text-ink">{formatPaise(previewPaise)}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-ink-muted">GST</span>
              <span className="tabular-nums text-ink">{formatPaise(previewTax)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-navy-900/10 pt-2 font-medium">
              <span className="text-ink">Line total</span>
              <span className="tabular-nums text-ink">
                {formatPaise(previewPaise + previewTax)}
              </span>
            </div>
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-navy-900/30 accent-brand-blue"
              {...register('isActive')}
            />
            Available for new invoices
          </label>
        </Card>

        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              navigate('/products');
            }}
          >
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {editing ? 'Save changes' : 'Add product'}
          </Button>
        </div>
      </form>
    </div>
  );
}
