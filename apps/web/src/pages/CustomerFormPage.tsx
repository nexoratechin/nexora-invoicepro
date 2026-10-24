import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';

import { GST_STATE_CODE_LIST } from '@nexora/shared';

import { PageHeader } from '../components/layout';
import { Alert, Button, Card, Field, Input, Select, Spinner, Textarea } from '../components/ui';
import { apiRequest, errorMessage } from '../lib/api';
import type { ApiCustomer } from '../lib/invoice';
import { customerFormSchema, type CustomerFormValues } from '../lib/validation';
import { useApi } from '../lib/useApi';
import { zodResolver } from '../lib/zod-resolver';

const emptyValues: CustomerFormValues = {
  name: '',
  email: '',
  phone: '',
  gstin: '',
  stateCode: '',
  notes: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  pincode: '',
};

export function CustomerFormPage() {
  const { id } = useParams<{ id: string }>();
  const editing = id !== undefined;
  const navigate = useNavigate();
  const [failure, setFailure] = useState<string | null>(null);
  const [details, setDetails] = useState<string[]>([]);

  const { data, loading } = useApi<{ customer: ApiCustomer }>(
    editing ? `/customers/${String(id)}` : null,
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (data === null) return;

    const customer = data.customer;

    reset({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      gstin: customer.gstin,
      stateCode: customer.stateCode,
      notes: customer.notes,
      line1: customer.billingAddress.line1,
      line2: customer.billingAddress.line2,
      city: customer.billingAddress.city,
      state: customer.billingAddress.state,
      pincode: customer.billingAddress.pincode,
    });
  }, [data, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null);
    setDetails([]);

    const payload = {
      name: values.name,
      email: values.email,
      phone: values.phone,
      gstin: values.gstin,
      stateCode: values.stateCode,
      notes: values.notes,
      billingAddress: {
        line1: values.line1,
        line2: values.line2,
        city: values.city,
        state: values.state,
        pincode: values.pincode,
        country: 'India',
      },
    };

    try {
      if (editing) {
        await apiRequest(`/customers/${String(id)}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        navigate(`/customers/${String(id)}`);
      } else {
        const created = await apiRequest<{ customer: ApiCustomer }>('/customers', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        navigate(`/customers/${created.customer.id}`);
      }
    } catch (error) {
      setFailure(errorMessage(error));
      setDetails(
        Array.isArray((error as { details?: unknown }).details)
          ? (error as { details: { message?: string }[] }).details
              .map((detail) => detail.message)
              .filter((message): message is string => typeof message === 'string')
          : [],
      );
    }
  });

  if (editing && loading && data === null) {
    return <Spinner label="Loading the customer" />;
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={editing ? 'Edit customer' : 'New customer'}
        description={
          editing
            ? 'Changes apply to new invoices. Issued invoices keep their snapshot.'
            : 'Only a name is required. The rest helps the invoice look right.'
        }
        backTo={{ to: '/customers', label: 'Customers' }}
      />

      {failure !== null && (
        <div className="mb-4">
          <Alert tone="error" title="Could not save the customer">
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

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Card title="Contact">
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
                placeholder="Acme Traders"
                invalid={errors.name !== undefined}
                {...register('name')}
              />
            </Field>
            <Field label="Email" htmlFor="email" error={errors.email?.message}>
              <Input
                id="email"
                type="email"
                placeholder="billing@acme.in"
                invalid={errors.email !== undefined}
                {...register('email')}
              />
            </Field>
            <Field label="Phone" htmlFor="phone" error={errors.phone?.message}>
              <Input
                id="phone"
                placeholder="+91 98765 43210"
                invalid={errors.phone !== undefined}
                {...register('phone')}
              />
            </Field>
            <Field
              label="GSTIN"
              htmlFor="gstin"
              error={errors.gstin?.message}
              hint="Optional. Needed for their input credit."
            >
              <Input
                id="gstin"
                placeholder="24AAAAA0000A1Z5"
                className="font-mono uppercase"
                invalid={errors.gstin !== undefined}
                {...register('gstin')}
              />
            </Field>
            <Field
              label="State"
              htmlFor="stateCode"
              error={errors.stateCode?.message}
              hint="Sets the place of supply for this customer."
            >
              <Select id="stateCode" {...register('stateCode')}>
                <option value="">Same as your business</option>
                {GST_STATE_CODE_LIST.map((state) => (
                  <option key={state.code} value={state.code}>
                    {state.code} - {state.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <Card title="Billing address">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Address line 1" htmlFor="line1" className="sm:col-span-2">
              <Input id="line1" placeholder="12 Market Road" {...register('line1')} />
            </Field>
            <Field label="Address line 2" htmlFor="line2" className="sm:col-span-2">
              <Input id="line2" placeholder="Near the old post office" {...register('line2')} />
            </Field>
            <Field label="City" htmlFor="city">
              <Input id="city" placeholder="Mumbai" {...register('city')} />
            </Field>
            <Field label="State" htmlFor="state">
              <Input id="state" placeholder="Maharashtra" {...register('state')} />
            </Field>
            <Field label="PIN code" htmlFor="pincode">
              <Input id="pincode" placeholder="400001" {...register('pincode')} />
            </Field>
          </div>
        </Card>

        <Card title="Notes">
          <Field
            label="Internal notes"
            htmlFor="notes"
            error={errors.notes?.message}
            hint="Only your team sees this."
          >
            <Textarea
              id="notes"
              rows={3}
              placeholder="Prefers UPI. Ask for Priya."
              {...register('notes')}
            />
          </Field>
        </Card>

        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              navigate('/customers');
            }}
          >
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {editing ? 'Save changes' : 'Add customer'}
          </Button>
        </div>
      </form>
    </div>
  );
}
