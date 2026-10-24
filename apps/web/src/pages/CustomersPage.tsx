import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Users } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  LinkButton,
  Pagination,
  Select,
  Skeleton,
} from '../components/ui';
import { PageHeader } from '../components/layout';
import { apiRequest } from '../lib/api';
import { formatDate } from '../lib/format';
import type { ApiCustomer, Page } from '../lib/invoice';
import { useApi, useDebounced } from '../lib/useApi';

export function CustomersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'active' | 'archived' | ''>('active');
  const [page, setPage] = useState(1);
  const query = useDebounced(search.trim(), 300);

  const path = `/customers?page=${page}&pageSize=10${query === '' ? '' : `&q=${encodeURIComponent(query)}`}${
    status === '' ? '' : `&status=${status}`
  }`;
  const { data, loading, error, reload } = useApi<Page<ApiCustomer>>(path);

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Everyone you bill. Archived customers stay out of new invoices."
        actions={
          <LinkButton to="/customers/new">
            <Plus aria-hidden="true" className="h-4 w-4" />
            New customer
          </LinkButton>
        }
      />

      <Card flush>
        <div className="flex flex-wrap gap-3 border-b border-navy-900/10 p-4">
          <div className="relative min-w-56 flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
            />
            <Input
              aria-label="Search customers"
              placeholder="Search name, email, phone or GSTIN"
              className="pl-9"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            aria-label="Filter by status"
            className="w-40"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as 'active' | 'archived' | '');
              setPage(1);
            }}
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="">All</option>
          </Select>
        </div>

        {loading && data === null && (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-10" />
            ))}
          </div>
        )}

        {error !== null && (
          <div className="p-5">
            <p className="text-sm text-red-700">{error.message}</p>
            <Button variant="secondary" className="mt-3" onClick={reload}>
              Try again
            </Button>
          </div>
        )}

        {data !== null && data.items.length === 0 && (
          <EmptyState
            icon={<Users aria-hidden="true" className="h-5 w-5" />}
            title={query === '' ? 'No customers yet' : 'No matches'}
            description={
              query === ''
                ? 'Add the first customer to start invoicing.'
                : 'Try a different search term or status.'
            }
            action={
              query === '' ? <LinkButton to="/customers/new">Add a customer</LinkButton> : undefined
            }
          />
        )}

        {data !== null && data.items.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-mist text-xs uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Customer
                    </th>
                    <th scope="col" className="hidden px-5 py-2.5 font-medium md:table-cell">
                      Phone
                    </th>
                    <th scope="col" className="hidden px-5 py-2.5 font-medium sm:table-cell">
                      GSTIN
                    </th>
                    <th scope="col" className="hidden px-5 py-2.5 font-medium lg:table-cell">
                      Added
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/5">
                  {data.items.map((customer) => (
                    <tr
                      key={customer.id}
                      onClick={() => {
                        navigate(`/customers/${customer.id}`);
                      }}
                      className="cursor-pointer transition hover:bg-mist"
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium text-ink">{customer.name}</p>
                        <p className="text-xs text-ink-muted">
                          {customer.email === '' ? 'No email' : customer.email}
                        </p>
                      </td>
                      <td className="hidden px-5 py-3 text-ink-muted md:table-cell">
                        {customer.phone === '' ? '-' : customer.phone}
                      </td>
                      <td className="hidden px-5 py-3 font-mono text-xs text-ink-muted sm:table-cell">
                        {customer.gstin === '' ? '-' : customer.gstin}
                      </td>
                      <td className="hidden px-5 py-3 text-ink-muted lg:table-cell">
                        {formatDate(customer.createdAt)}
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={customer.status === 'active' ? 'green' : 'neutral'}>
                          {customer.status === 'active' ? 'Active' : 'Archived'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              onChange={setPage}
            />
          </>
        )}
      </Card>
    </div>
  );
}

export async function archiveCustomer(id: string, action: 'archive' | 'restore'): Promise<void> {
  await apiRequest(`/customers/${id}/${action}`, { method: 'POST', body: '{}' });
}
