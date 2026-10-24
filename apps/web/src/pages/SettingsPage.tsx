import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

import { GST_SLABS_BP, GST_STATE_CODE_LIST } from '@nexora/shared';

import { PageHeader } from '../components/layout';
import { Alert, Button, Card, Field, Input, Select, Textarea } from '../components/ui';
import { apiRequest, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  businessFormSchema,
  profileFormSchema,
  settingsFormSchema,
  type BusinessFormValues,
  type ProfileFormValues,
  type SettingsFormValues,
} from '../lib/validation';
import { zodResolver } from '../lib/zod-resolver';

export function SettingsPage() {
  const { session, reloadSession, logout } = useAuth();
  const navigate = useNavigate();
  const [notice, setNotice] = useState<string | null>(null);

  if (session === null) {
    return null;
  }

  const business = session.business;
  const settings = session.settings;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Settings"
        description="Business details, invoice defaults and your own profile."
      />

      {notice !== null && (
        <div className="mb-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      )}

      <BusinessForm
        values={{
          name: business.name,
          legalName: business.legalName,
          gstin: business.gstin,
          stateCode: business.stateCode,
          phone: business.phone,
          email: business.email,
          website: business.website,
          line1: business.address.line1,
          line2: business.address.line2,
          city: business.address.city,
          state: business.address.state,
          pincode: business.address.pincode,
        }}
        onSaved={() => {
          setNotice('Business details saved.');
          void reloadSession();
        }}
      />

      <div className="mt-4">
        <InvoicingForm
          values={{
            invoicePrefix: settings?.invoicePrefix ?? 'NXP',
            defaultPaymentTermsDays: String(settings?.defaultPaymentTermsDays ?? 15),
            defaultTaxRateBp: String(settings?.defaultTaxRateBp ?? 1800),
            defaultNotes: settings?.defaultNotes ?? '',
            paymentInstructions: settings?.paymentInstructions ?? '',
            accountName: settings?.bankDetails.accountName ?? '',
            accountNumber: settings?.bankDetails.accountNumber ?? '',
            ifsc: settings?.bankDetails.ifsc ?? '',
            bankName: settings?.bankDetails.bankName ?? '',
            upiId: settings?.bankDetails.upiId ?? '',
          }}
          onSaved={() => {
            setNotice('Invoice settings saved.');
            void reloadSession();
          }}
        />
      </div>

      <div className="mt-4">
        <ProfileForm
          values={{ name: session.user.name, phone: session.user.phone ?? '' }}
          onSaved={() => {
            setNotice('Profile saved.');
            void reloadSession();
          }}
        />
      </div>

      <div className="mt-4">
        <PasswordForm
          onChanged={() => {
            void logout().finally(() => {
              navigate('/login', { replace: true });
            });
          }}
        />
      </div>
    </div>
  );
}

function BusinessForm({ values, onSaved }: { values: BusinessFormValues; onSaved: () => void }) {
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BusinessFormValues>({
    resolver: zodResolver(businessFormSchema),
    defaultValues: values,
  });

  const onSubmit = handleSubmit(async (form) => {
    setFailure(null);

    try {
      await apiRequest('/business', {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name,
          legalName: form.legalName,
          gstin: form.gstin,
          stateCode: form.stateCode,
          phone: form.phone,
          email: form.email,
          website: form.website,
          address: {
            line1: form.line1,
            line2: form.line2,
            city: form.city,
            state: form.state,
            pincode: form.pincode,
            country: 'India',
          },
        }),
      });
      onSaved();
    } catch (error) {
      setFailure(errorMessage(error));
    }
  });

  return (
    <Card title="Business profile" description="Appears on every invoice you issue.">
      {failure !== null && (
        <div className="mb-3">
          <Alert tone="error">{failure}</Alert>
        </div>
      )}

      <form onSubmit={onSubmit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Business name"
            htmlFor="biz-name"
            error={errors.name?.message}
            required
            className="sm:col-span-2"
          >
            <Input id="biz-name" invalid={errors.name !== undefined} {...register('name')} />
          </Field>
          <Field
            label="Legal name"
            htmlFor="biz-legal"
            error={errors.legalName?.message}
            className="sm:col-span-2"
          >
            <Input id="biz-legal" {...register('legalName')} />
          </Field>
          <Field label="GSTIN" htmlFor="biz-gstin" error={errors.gstin?.message}>
            <Input
              id="biz-gstin"
              className="font-mono uppercase"
              invalid={errors.gstin !== undefined}
              {...register('gstin')}
            />
          </Field>
          <Field
            label="State"
            htmlFor="biz-state"
            error={errors.stateCode?.message}
            hint="Decides CGST + SGST against IGST."
            required
          >
            <Select id="biz-state" {...register('stateCode')}>
              {GST_STATE_CODE_LIST.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.code} - {state.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Phone" htmlFor="biz-phone" error={errors.phone?.message}>
            <Input id="biz-phone" {...register('phone')} />
          </Field>
          <Field label="Email" htmlFor="biz-email" error={errors.email?.message}>
            <Input
              id="biz-email"
              type="email"
              invalid={errors.email !== undefined}
              {...register('email')}
            />
          </Field>
          <Field
            label="Website"
            htmlFor="biz-website"
            error={errors.website?.message}
            className="sm:col-span-2"
          >
            <Input id="biz-website" {...register('website')} />
          </Field>
          <Field label="Address line 1" htmlFor="biz-line1" className="sm:col-span-2">
            <Input id="biz-line1" {...register('line1')} />
          </Field>
          <Field label="Address line 2" htmlFor="biz-line2" className="sm:col-span-2">
            <Input id="biz-line2" {...register('line2')} />
          </Field>
          <Field label="City" htmlFor="biz-city">
            <Input id="biz-city" {...register('city')} />
          </Field>
          <Field label="State name" htmlFor="biz-state-name">
            <Input id="biz-state-name" {...register('state')} />
          </Field>
          <Field label="PIN code" htmlFor="biz-pincode">
            <Input id="biz-pincode" {...register('pincode')} />
          </Field>
        </div>

        <div className="mt-4 flex justify-end">
          <Button type="submit" loading={isSubmitting}>
            Save business details
          </Button>
        </div>
      </form>
    </Card>
  );
}

function InvoicingForm({ values, onSaved }: { values: SettingsFormValues; onSaved: () => void }) {
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: values,
  });

  const onSubmit = handleSubmit(async (form) => {
    setFailure(null);

    try {
      await apiRequest('/settings', {
        method: 'PUT',
        body: JSON.stringify({
          invoicePrefix: form.invoicePrefix,
          defaultPaymentTermsDays: Number(form.defaultPaymentTermsDays),
          defaultTaxRateBp: Number(form.defaultTaxRateBp),
          defaultNotes: form.defaultNotes,
          paymentInstructions: form.paymentInstructions,
          bankDetails: {
            accountName: form.accountName,
            accountNumber: form.accountNumber,
            ifsc: form.ifsc,
            bankName: form.bankName,
            upiId: form.upiId,
          },
        }),
      });
      onSaved();
    } catch (error) {
      setFailure(errorMessage(error));
    }
  });

  return (
    <Card
      title="Invoice defaults"
      description="New invoices start with these values. Changing the prefix does not renumber issued invoices."
    >
      {failure !== null && (
        <div className="mb-3">
          <Alert tone="error">{failure}</Alert>
        </div>
      )}

      <form onSubmit={onSubmit} noValidate>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Invoice prefix"
            htmlFor="set-prefix"
            error={errors.invoicePrefix?.message}
            hint="3 to 8 letters or digits."
            required
          >
            <Input
              id="set-prefix"
              className="font-mono uppercase"
              invalid={errors.invoicePrefix !== undefined}
              {...register('invoicePrefix')}
            />
          </Field>
          <Field
            label="Payment terms (days)"
            htmlFor="set-terms"
            error={errors.defaultPaymentTermsDays?.message}
            required
          >
            <Input
              id="set-terms"
              inputMode="numeric"
              invalid={errors.defaultPaymentTermsDays !== undefined}
              {...register('defaultPaymentTermsDays')}
            />
          </Field>
          <Field
            label="Default GST rate"
            htmlFor="set-tax"
            error={errors.defaultTaxRateBp?.message}
            required
          >
            <Select id="set-tax" {...register('defaultTaxRateBp')}>
              {GST_SLABS_BP.map((slab) => (
                <option key={slab} value={String(slab)}>
                  {slab / 100}%
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Default note"
            htmlFor="set-notes"
            className="sm:col-span-3"
            error={errors.defaultNotes?.message}
          >
            <Textarea id="set-notes" rows={2} {...register('defaultNotes')} />
          </Field>
          <Field
            label="Payment instructions"
            htmlFor="set-instructions"
            className="sm:col-span-3"
            error={errors.paymentInstructions?.message}
            hint="Printed on the invoice below the total."
          >
            <Textarea id="set-instructions" rows={2} {...register('paymentInstructions')} />
          </Field>
        </div>

        <h3 className="mb-3 mt-6 text-sm font-semibold text-ink">Bank details</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Account name" htmlFor="bank-name" error={errors.accountName?.message}>
            <Input id="bank-name" {...register('accountName')} />
          </Field>
          <Field label="Bank" htmlFor="bank-bank" error={errors.bankName?.message}>
            <Input id="bank-bank" {...register('bankName')} />
          </Field>
          <Field label="Account number" htmlFor="bank-number" error={errors.accountNumber?.message}>
            <Input id="bank-number" className="font-mono" {...register('accountNumber')} />
          </Field>
          <Field label="IFSC" htmlFor="bank-ifsc" error={errors.ifsc?.message}>
            <Input id="bank-ifsc" className="font-mono uppercase" {...register('ifsc')} />
          </Field>
          <Field
            label="UPI ID"
            htmlFor="bank-upi"
            error={errors.upiId?.message}
            className="sm:col-span-2"
          >
            <Input id="bank-upi" placeholder="business@upi" {...register('upiId')} />
          </Field>
        </div>

        <div className="mt-4 flex justify-end">
          <Button type="submit" loading={isSubmitting}>
            Save invoice settings
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ProfileForm({ values, onSaved }: { values: ProfileFormValues; onSaved: () => void }) {
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: values,
  });

  const onSubmit = handleSubmit(async (form) => {
    setFailure(null);

    try {
      await apiRequest('/me', {
        method: 'PATCH',
        body: JSON.stringify({ name: form.name, phone: form.phone === '' ? null : form.phone }),
      });
      onSaved();
    } catch (error) {
      setFailure(errorMessage(error));
    }
  });

  return (
    <Card title="Your profile" description="Your name and phone. Only your team sees these.">
      {failure !== null && (
        <div className="mb-3">
          <Alert tone="error">{failure}</Alert>
        </div>
      )}

      <form onSubmit={onSubmit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="profile-name" error={errors.name?.message} required>
            <Input id="profile-name" invalid={errors.name !== undefined} {...register('name')} />
          </Field>
          <Field label="Phone" htmlFor="profile-phone" error={errors.phone?.message}>
            <Input
              id="profile-phone"
              placeholder="+91 98765 43210"
              invalid={errors.phone !== undefined}
              {...register('phone')}
            />
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Button type="submit" loading={isSubmitting}>
            Save profile
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PasswordForm({ onChanged }: { onChanged: () => void }) {
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  const tooShort = next.length < 10;
  const mismatch = confirm !== next;
  const disabled = busy || current === '' || tooShort || mismatch;

  async function submit(): Promise<void> {
    setBusy(true);
    setFailure(null);

    try {
      await apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      onChanged();
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Password"
      description="Changing it signs you out everywhere, because every refresh token is revoked."
    >
      {failure !== null && (
        <div className="mb-3">
          <Alert tone="error">{failure}</Alert>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Current password" htmlFor="pw-current" required>
          <Input
            id="pw-current"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(event) => {
              setCurrent(event.target.value);
            }}
          />
        </Field>
        <Field
          label="New password"
          htmlFor="pw-next"
          error={next !== '' && tooShort ? 'Use at least 10 characters' : undefined}
          required
        >
          <Input
            id="pw-next"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(event) => {
              setNext(event.target.value);
            }}
          />
        </Field>
        <Field
          label="Confirm new password"
          htmlFor="pw-confirm"
          error={confirm !== '' && mismatch ? 'The two passwords differ' : undefined}
          required
        >
          <Input
            id="pw-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => {
              setConfirm(event.target.value);
            }}
          />
        </Field>
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          loading={busy}
          disabled={disabled}
          onClick={() => {
            void submit();
          }}
        >
          Change password
        </Button>
      </div>
    </Card>
  );
}
