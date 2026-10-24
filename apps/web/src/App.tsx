import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout, AuthLayout, PublicOnly, RequireAuth } from './components/layout';
import { AuthProvider } from './lib/auth';
import { CustomerDetailPage } from './pages/CustomerDetailPage';
import { CustomerFormPage } from './pages/CustomerFormPage';
import { CustomersPage } from './pages/CustomersPage';
import { DashboardPage } from './pages/DashboardPage';
import { InvoiceDetailPage } from './pages/InvoiceDetailPage';
import { InvoiceEditorPage } from './pages/InvoiceEditorPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { ProductFormPage } from './pages/ProductFormPage';
import { ProductsPage } from './pages/ProductsPage';
import { RegisterPage } from './pages/RegisterPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<PublicOnly />}>
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Route>
          </Route>

          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />

              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/customers/new" element={<CustomerFormPage />} />
              <Route path="/customers/:id" element={<CustomerDetailPage />} />
              <Route path="/customers/:id/edit" element={<CustomerFormPage />} />

              <Route path="/products" element={<ProductsPage />} />
              <Route path="/products/new" element={<ProductFormPage />} />
              <Route path="/products/:id/edit" element={<ProductFormPage />} />

              <Route path="/invoices" element={<InvoicesPage />} />
              <Route path="/invoices/new" element={<InvoiceEditorPage />} />
              <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
              <Route path="/invoices/:id/edit" element={<InvoiceEditorPage />} />

              <Route path="/payments" element={<PaymentsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
