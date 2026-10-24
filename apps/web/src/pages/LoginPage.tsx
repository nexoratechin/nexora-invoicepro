import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';

import { Alert, Button, Field, Input } from '../components/ui';
import { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { loginFormSchema, type LoginFormValues } from '../lib/validation';
import { zodResolver } from '../lib/zod-resolver';

export function LoginPage() {
  const { login } = useAuth();
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null);

    try {
      await login(values.email, values.password);
    } catch (error) {
      setFailure(errorMessage(error));
    }
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink">Sign in</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Welcome back. Your invoices and customers are where you left them.
      </p>

      {failure !== null && (
        <div className="mt-5">
          <Alert tone="error" title="Could not sign in">
            {failure}
          </Alert>
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        <Field label="Email" htmlFor="email" error={errors.email?.message} required>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.in"
            invalid={errors.email !== undefined}
            {...register('email')}
          />
        </Field>

        <Field label="Password" htmlFor="password" error={errors.password?.message} required>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            invalid={errors.password !== undefined}
            {...register('password')}
          />
        </Field>

        <Button type="submit" loading={isSubmitting} className="w-full">
          {isSubmitting ? 'Signing in' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-5 text-sm text-ink-muted">
        New here?{' '}
        <Link to="/register" className="font-medium text-brand-blue hover:underline">
          Create an account
        </Link>
      </p>

      <div className="mt-8 rounded-lg border border-navy-900/10 bg-white p-4">
        <p className="text-xs font-medium text-ink">Demo account</p>
        <p className="mt-1 text-xs text-ink-muted">
          Run <code className="rounded bg-navy-900/5 px-1 py-0.5 font-mono">npm run seed</code>,
          then sign in with:
        </p>
        <p className="mt-2 font-mono text-xs text-ink">demo@nexora.test</p>
        <p className="font-mono text-xs text-ink">nexora-demo-password</p>
      </div>
    </div>
  );
}
