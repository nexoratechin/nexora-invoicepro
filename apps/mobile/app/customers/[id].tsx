import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatPaise } from '@nexora/shared';

import { api, type ApiCustomer } from '../../src/api';
import { spacing, type } from '../../src/theme';
import {
  Badge,
  Button,
  Card,
  ErrorBanner,
  Loading,
  Row,
  Screen,
  SectionTitle,
  useFetch,
} from '../../src/ui';

interface Detail {
  customer: ApiCustomer;
  stats: {
    totalBilledMinor: number;
    totalPaidMinor: number;
    outstandingMinor: number;
    invoiceCount: number;
  };
}

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, error, loading, reload } = useFetch<Detail>(
    () => api<Detail>(`/customers/${id}`),
    [id],
  );

  if (loading && data === null) {
    return (
      <Screen>
        <Loading label="Loading the customer" />
      </Screen>
    );
  }

  if (data === null) {
    return (
      <Screen>
        <ErrorBanner message={error ?? 'Customer not found'} onRetry={reload} />
      </Screen>
    );
  }

  const { customer, stats } = data;
  const address = [
    customer.billingAddress.line1,
    customer.billingAddress.city,
    customer.billingAddress.state,
    customer.billingAddress.pincode,
  ]
    .filter((part) => part !== '')
    .join(', ');

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <View style={styles.header}>
        <Text style={type.title}>{customer.name}</Text>
        <Badge
          label={customer.status === 'active' ? 'Active' : 'Archived'}
          tone={customer.status === 'active' ? 'green' : 'neutral'}
        />
      </View>

      {error !== null && <ErrorBanner message={error} onRetry={reload} />}

      <Card>
        <SectionTitle>Contact</SectionTitle>
        <Row label="Email" value={customer.email === '' ? '-' : customer.email} />
        <Row label="Phone" value={customer.phone === '' ? '-' : customer.phone} />
        <Row label="GSTIN" value={customer.gstin === '' ? 'Not set' : customer.gstin} />
        <Row
          label="State code"
          value={customer.stateCode === '' ? 'Business default' : customer.stateCode}
        />
        <Row label="Address" value={address === '' ? '-' : address} />
      </Card>

      <Card>
        <SectionTitle>Lifetime value</SectionTitle>
        <Row label="Billed" value={formatPaise(stats.totalBilledMinor)} />
        <Row label="Paid" value={formatPaise(stats.totalPaidMinor)} />
        <Row label="Outstanding" value={formatPaise(stats.outstandingMinor)} />
        <Row label="Invoices" value={String(stats.invoiceCount)} />
      </Card>

      <Button
        label="New invoice for this customer"
        icon="add"
        onPress={() => {
          router.push(`/invoices/new?customerId=${customer.id}`);
        }}
      />

      <Text style={styles.footer}>
        Issued invoices keep the address and GSTIN they were raised with.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  footer: { ...type.muted, fontSize: 11, textAlign: 'center' },
});
