import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatPaise } from '@nexora/shared';

import { api, type ApiInvoice, type Page } from '../../src/api';
import { InvoiceRow } from '../../src/components';
import { colors, spacing, type } from '../../src/theme';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorBanner,
  Loading,
  Screen,
  useFetch,
} from '../../src/ui';

const filters = [
  { id: 'all', label: 'All' },
  { id: 'unpaid', label: 'Unpaid' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'draft', label: 'Drafts' },
] as const;

type FilterId = (typeof filters)[number]['id'];

function queryFor(filter: FilterId): string {
  if (filter === 'draft') return 'status=draft';
  if (filter === 'overdue') return 'overdue=true';

  return '';
}

export default function InvoicesScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterId>('all');
  const { data, error, loading, reload } = useFetch<Page<ApiInvoice>>(
    () => api<Page<ApiInvoice>>(`/invoices?pageSize=50&sort=-invoiceDate&${queryFor(filter)}`),
    [filter],
  );

  const visible = (data?.items ?? []).filter((invoice) => {
    if (filter === 'unpaid') return invoice.paymentState !== 'paid' && invoice.status === 'issued';

    return true;
  });

  const outstanding = visible.reduce((sum, invoice) => sum + invoice.balanceDueMinor, 0);

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <View>
        <Text style={type.title}>Invoices</Text>
        <Text style={[type.muted, styles.subtitle]}>
          {data === null
            ? 'Loading'
            : `${String(data.total)} total · ${formatPaise(outstanding)} outstanding here`}
        </Text>
      </View>

      <View style={styles.chips}>
        {filters.map((option) => (
          <Chip
            key={option.id}
            label={option.label}
            active={filter === option.id}
            onPress={() => {
              setFilter(option.id);
            }}
          />
        ))}
      </View>

      {error !== null && <ErrorBanner message={error} onRetry={reload} />}

      {loading && data === null && <Loading label="Loading invoices" />}

      {data !== null && visible.length === 0 && (
        <Card>
          <EmptyState
            icon="document-text-outline"
            title={filter === 'all' ? 'No invoices yet' : 'Nothing matches'}
            description={
              filter === 'all'
                ? 'Create a draft, check the totals, then issue it.'
                : 'Try a different filter.'
            }
          />
        </Card>
      )}

      {visible.length > 0 && (
        <View style={styles.list}>
          {visible.map((invoice) => (
            <InvoiceRow
              key={invoice.id}
              invoice={invoice}
              onPress={() => {
                router.push(`/invoices/${invoice.id}`);
              }}
            />
          ))}
        </View>
      )}

      <Button
        label="New invoice"
        icon="add"
        onPress={() => {
          router.push('/invoices/new');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  list: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
});
