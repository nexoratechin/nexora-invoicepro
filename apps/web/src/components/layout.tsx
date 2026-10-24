import { useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  Users,
  Wallet,
  X,
} from 'lucide-react';

import { BrandMark } from './BrandMark';
import { Spinner } from './ui';
import { useAuth } from '../lib/auth';
import { initials } from '../lib/format';

const navigation = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/invoices', label: 'Invoices', icon: FileText },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/payments', label: 'Payments', icon: Wallet },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {navigation.map((item) => {
        const Icon = item.icon;

        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                isActive
                  ? 'bg-white/10 font-medium text-white'
                  : 'text-mist/70 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  aria-hidden="true"
                  className={`h-4 w-4 ${isActive ? 'text-brand-cyan' : ''}`}
                />
                {item.label}
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}

function BrandBlock() {
  return (
    <div className="flex items-center gap-3 px-6 py-5">
      <BrandMark className="h-9 w-9" />
      <div className="leading-tight">
        <p className="text-sm font-semibold text-white">Nexora InvoicePro</p>
        <p className="text-[11px] text-mist/50">Innovate | Automate | Transform</p>
      </div>
    </div>
  );
}

function AccountFooter() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  if (session === null) {
    return null;
  }

  return (
    <div className="border-t border-white/10 p-3">
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-blue text-xs font-semibold text-white">
          {initials(session.user.name)}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-xs font-medium text-white">{session.user.name}</p>
          <p className="truncate text-[11px] text-mist/50">{session.role}</p>
        </div>
        <button
          type="button"
          aria-label="Sign out"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void logout().finally(() => {
              navigate('/login', { replace: true });
            });
          }}
          className="rounded-lg p-1.5 text-mist/60 transition hover:bg-white/10 hover:text-white"
        >
          <LogOut aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function AppLayout() {
  const { session } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-mist">
      <a
        href="#main-content"
        className="sr-only rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-navy-950 lg:flex">
        <BrandBlock />
        <NavItems />
        <AccountFooter />
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-navy-950/50"
            role="presentation"
            onClick={() => {
              setMenuOpen(false);
            }}
          />
          <aside id="mobile-menu" className="relative flex h-full w-72 flex-col bg-navy-950">
            <div className="flex items-center justify-between pr-3">
              <BrandBlock />
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => {
                  setMenuOpen(false);
                }}
                className="rounded-lg p-2 text-mist/70 hover:bg-white/10 hover:text-white"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
            <NavItems
              onNavigate={() => {
                setMenuOpen(false);
              }}
            />
            <AccountFooter />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-navy-900/10 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => {
              setMenuOpen(true);
            }}
            className="rounded-lg p-2 text-ink-muted hover:bg-navy-900/5 lg:hidden"
          >
            <Menu aria-hidden="true" className="h-5 w-5" />
          </button>
          <p className="truncate text-sm font-medium text-ink">
            {session?.business.name ?? 'Nexora InvoicePro'}
          </p>
          <span className="ml-auto hidden text-xs text-ink-muted sm:block">
            {session?.business.gstin !== undefined && session.business.gstin !== ''
              ? `GSTIN ${session.business.gstin}`
              : 'GSTIN not set'}
          </span>
        </header>

        <main id="main-content" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function AuthLayout() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-navy-950 p-10 lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-blue/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-brand-cyan/20 blur-3xl"
        />
        <div className="relative flex items-center gap-3">
          <BrandMark className="h-10 w-10" />
          <div>
            <p className="text-sm font-semibold text-white">Nexora InvoicePro</p>
            <p className="text-xs text-mist/50">Innovate | Automate | Transform</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-3xl font-semibold leading-tight text-white">
            Invoicing that adds up, to the paisa.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-mist/60">
            GST invoices, customers, products and payments for small businesses. One API, a web app
            and a mobile app.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-mist/70">
            {[
              'Totals are computed on the server, in integer paise',
              'CGST, SGST and IGST split from the place of supply',
              'Every business sees only its own records',
            ].map((line) => (
              <li key={line} className="flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className="mt-1.5 h-1.5 w-1.5 rounded-full bg-brand-cyan"
                />
                {line}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-mist/40">
          Nexora Technologies. Tax figures are software calculations, not tax advice.
        </p>
      </div>

      <div className="flex items-center justify-center bg-mist px-5 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark className="h-9 w-9" />
            <p className="text-sm font-semibold text-ink">Nexora InvoicePro</p>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mist">
        <Spinner label="Restoring your session" />
      </div>
    );
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

export function PublicOnly() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mist">
        <Spinner label="Checking your session" />
      </div>
    );
  }

  if (status === 'authenticated') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

export function PageHeader({
  title,
  description,
  actions,
  backTo,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  backTo?: { to: string; label: string };
}) {
  return (
    <div className="mb-6">
      {backTo !== undefined && (
        <NavLink
          to={backTo.to}
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-ink"
        >
          <span aria-hidden="true">←</span> {backTo.label}
        </NavLink>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          {description !== undefined && (
            <p className="mt-1 text-sm text-ink-muted">{description}</p>
          )}
        </div>
        {actions !== undefined && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
