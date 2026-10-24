import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';

import { GST_STATE_CODE_LIST } from '@nexora/shared';

import { Alert, Button, Field, Input, Select } from '../components/ui';
import { errorMessage, validationMessages } from '../lib/api';
import { useAuth } from '../lib/auth';
import { registerFormSchema, type RegisterFormValues } from '../lib/validation';
import { zodResolver } from '../lib/zod-resolver';

export function RegisterPage() {
  const { register: registerAccount } = useAuth();
  const [failure, setFailure] = useState<string | null>(null);
  const [details, setDetails] = useState<string[]>([]);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      businessName: '',
      stateCode: '24',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null);
    setDetails([]);

    try {
      await registerAccount(values);
    } catch (error) {
      setFailure(errorMessage(error));
      setDetails(validationMessages(error));
    }
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink">Create your business account</h1>
      <p className="mt-1 text-sm text-ink-muted">
        One account, one business, ready to raise its first invoice.
      </p>

      {failure !== null && (
        <div className="mt-5">
          <Alert tone="error" title="Could not create the account">
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

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        <Field label="Your name" htmlFor="name" error={errors.name?.message} required>
          <Input
            id="name"
            autoComplete="name"
            placeholder="Parth Prajapati"
            invalid={errors.name !== undefined}
            {...register('name')}
          />
        </Field>

        <Field label="Work email" htmlFor="email" error={errors.email?.message} required>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.in"
            invalid={errors.email !== undefined}
            {...register('email')}
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          error={errors.password?.message}
          hint="At least 10 characters."
          required
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            invalid={errors.password !== undefined}
            {...register('password')}
          />
        </Field>

        <Field
          label="Business name"
          htmlFor="businessName"
          error={errors.businessName?.message}
          required
        >
          <Input
            id="businessName"
            placeholder="Nexora Technologies"
            invalid={errors.businessName !== undefined}
            {...register('businessName')}
          />
        </Field>

        <Field
          label="Business state"
          htmlFor="stateCode"
          error={errors.stateCode?.message}
          hint="Used to decide CGST and SGST against IGST."
          required
        >
          <Select
            id="stateCode"
            invalid={errors.stateCode !== undefined}
            {...register('stateCode')}
          >
            {GST_STATE_CODE_LIST.map((state) => (
              <option key={state.code} value={state.code}>
                {state.code} - {state.name}
              </option>
            ))}
          </Select>
        </Field>

        <Button type="submit" loading={isSubmitting} className="w-full">
          {isSubmitting ? 'Creating account' : 'Create account'}
        </Button>
      </form>

      <p className="mt-5 text-sm text-ink-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-brand-blue hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
