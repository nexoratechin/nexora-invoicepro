import { forwardRef, useEffect } from 'react';
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { AlertCircle, CheckCircle2, Info, Loader2, X } from 'lucide-react';
import { Link } from 'react-router-dom';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-brand-blue text-white hover:bg-brand-blue-dark disabled:bg-brand-blue/50',
  secondary:
    'border border-navy-900/15 bg-white text-ink hover:border-navy-900/30 disabled:text-ink/40',
  ghost: 'text-ink-muted hover:bg-navy-900/5 hover:text-ink',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-600/50',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    className = '',
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled === true || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed ${
        size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm'
      } ${buttonVariants[variant]} ${className}`}
      {...rest}
    >
      {loading && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});

export interface FieldProps {
  label?: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required = false,
  className = '',
  children,
}: FieldProps) {
  return (
    <div className={className}>
      {label !== undefined && (
        <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
          {required && <span className="ml-0.5 text-red-600">*</span>}
        </label>
      )}
      {children}
      {error !== undefined && error !== '' ? (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
          <AlertCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : (
        hint !== undefined && <p className="mt-1.5 text-xs text-ink-muted">{hint}</p>
      )}
    </div>
  );
}

const fieldClasses =
  'w-full rounded-lg border bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 transition focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20 disabled:bg-navy-900/5';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid = false, className = '', ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid}
      className={`${fieldClasses} ${invalid ? 'border-red-400' : 'border-navy-900/15'} ${className}`}
      {...rest}
    />
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid = false, className = '', children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid}
      className={`${fieldClasses} ${invalid ? 'border-red-400' : 'border-navy-900/15'} ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className = '', ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={`${fieldClasses} border-navy-900/15 ${className}`}
      rows={3}
      {...rest}
    />
  );
});

export function Card({
  title,
  description,
  actions,
  children,
  className = '',
  flush = false,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <section className={`rounded-xl border border-navy-900/10 bg-white ${className}`}>
      {(title !== undefined || actions !== undefined) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-navy-900/10 px-5 py-4">
          <div>
            {title !== undefined && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
            {description !== undefined && (
              <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
            )}
          </div>
          {actions}
        </header>
      )}
      <div className={flush ? '' : 'p-5'}>{children}</div>
    </section>
  );
}

type Tone = 'neutral' | 'blue' | 'green' | 'amber' | 'red' | 'cyan' | 'violet';

const tones: Record<Tone, string> = {
  neutral: 'bg-navy-900/5 text-ink-muted ring-navy-900/10',
  blue: 'bg-brand-blue/10 text-brand-blue ring-brand-blue/20',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  cyan: 'bg-cyan-50 text-cyan-700 ring-cyan-600/20',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
};

export function Badge({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'error' | 'success' | 'warning';
  title?: string;
  children: ReactNode;
}) {
  const styles = {
    info: 'border-brand-blue/20 bg-brand-blue/5 text-ink',
    error: 'border-red-200 bg-red-50 text-red-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
  }[tone];

  const Icon =
    tone === 'error' || tone === 'warning' ? AlertCircle : tone === 'success' ? CheckCircle2 : Info;

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex gap-3 rounded-lg border p-3 text-sm ${styles}`}
    >
      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        {title !== undefined && <p className="font-medium">{title}</p>}
        <div className={title === undefined ? '' : 'mt-0.5'}>{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon !== undefined && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>
      {action !== undefined && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-navy-900/10 ${className}`} />;
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-ink-muted">
      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function LinkButton({
  to,
  variant = 'primary',
  size = 'md',
  children,
}: {
  to: string;
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition ${
        size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm'
      } ${buttonVariants[variant]}`}
    >
      {children}
    </Link>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (total === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-navy-900/10 px-5 py-3 text-xs text-ink-muted">
      <p>
        Page {page} of {Math.max(totalPages, 1)} · {total} total
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={page <= 1}
          onClick={() => {
            onChange(page - 1);
          }}
        >
          Previous
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={page >= totalPages}
          onClick={() => {
            onChange(page + 1);
          }}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-4 sm:items-center">
      <div role="presentation" className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 w-full max-w-lg rounded-xl bg-white p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            {description !== undefined && (
              <p className="mt-1 text-sm text-ink-muted">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-ink-muted transition hover:bg-navy-900/5 hover:text-ink"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
        {footer !== undefined && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
