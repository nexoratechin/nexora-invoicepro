import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Plus, Search } from 'lucide-react';

import { percent } from '../lib/format';
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
import { apiRequest, errorMessage } from '../lib/api';
import { money } from '../lib/format';
import type { ApiProduct, Page } from '../lib/invoice';
import { useApi, useDebounced } from '../lib/useApi';

export function ProductsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [active, setActive] = useState<'true' | 'false' | ''>('true');
  const [page, setPage] = useState(1);
  const [failure, setFailure] = useState<string | null>(null);
  const query = useDebounced(search.trim(), 300);

  const path = `/products?page=${page}&pageSize=10${query === '' ? '' : `&q=${encodeURIComponent(query)}`}${
    active === '' ? '' : `&isActive=${active}`
  }`;
  const { data, loading, error, reload } = useApi<Page<ApiProduct>>(path);

  async function toggle(product: ApiProduct): Promise<void> {
    setFailure(null);

    try {
      await apiRequest(`/products/${product.id}/status`, {
        method: 'POST',
        body: JSON.stringify({ isActive: !product.isActive }),
      });
      reload();
    } catch (cause) {
      setFailure(errorMessage(cause));
    }
  }

  return (
    <div>
      <PageHeader
        title="Products and services"
        description="Prices and GST rates you reuse on invoices. Inactive items stay on old invoices."
        actions={
          <LinkButton to="/products/new">
            <Plus aria-hidden="true" className="h-4 w-4" />
            New product
          </LinkButton>
        }
      />

      {failure !== null && (
        <div className="mb-4">
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {failure}
          </p>
        </div>
      )}

      <Card flush>
        <div className="flex flex-wrap gap-3 border-b border-navy-900/10 p-4">
          <div className="relative min-w-56 flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
            />
            <Input
              aria-label="Search products"
              placeholder="Search name, SKU or description"
              className="pl-9"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            aria-label="Filter by active state"
            className="w-40"
            value={active}
            onChange={(event) => {
              setActive(event.target.value as 'true' | 'false' | '');
              setPage(1);
            }}
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
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
            icon={<Package aria-hidden="true" className="h-5 w-5" />}
            title={query === '' ? 'No products yet' : 'No matches'}
            description={
              query === ''
                ? 'Add the services you sell once, then pick them on invoices.'
                : 'Try a different search or filter.'
            }
            action={
              query === '' ? <LinkButton to="/products/new">Add a product</LinkButton> : undefined
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
                      Item
                    </th>
                    <th scope="col" className="hidden px-5 py-2.5 font-medium sm:table-cell">
                      SKU
                    </th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">
                      Price
                    </th>
                    <th
                      scope="col"
                      className="hidden px-5 py-2.5 text-right font-medium md:table-cell"
                    >
                      GST
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Status
                    </th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/5">
                  {data.items.map((product) => (
                    <tr key={product.id} className="transition hover:bg-mist">
                      <td className="px-5 py-3">
                        <p className="font-medium text-ink">{product.name}</p>
                        <p className="text-xs text-ink-muted">per {product.unitLabel}</p>
                      </td>
                      <td className="hidden px-5 py-3 font-mono text-xs text-ink-muted sm:table-cell">
                        {product.sku ?? '-'}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-ink">
                        {money(product.unitPriceMinor)}
                      </td>
                      <td className="hidden px-5 py-3 text-right text-ink-muted md:table-cell">
                        {percent(product.taxRateBp)}
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={product.isActive ? 'green' : 'neutral'}>
                          {product.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-3 text-xs font-medium">
                          <button
                            type="button"
                            onClick={() => {
                              navigate(`/products/${product.id}/edit`);
                            }}
                            className="text-brand-blue hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void toggle(product);
                            }}
                            className="text-ink-muted hover:text-ink"
                          >
                            {product.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
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
