import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { api, type ApiCustomer, type Page } from '../../src/api';
import { colors, radius, spacing, type } from '../../src/theme';
import { Badge } from '../../src/ui';
import { Button, Card, EmptyState, ErrorBanner, Loading, Screen, useFetch } from '../../src/ui';

export default function CustomersScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const term = search.trim();
  const { data, error, loading, reload } = useFetch<Page<ApiCustomer>>(
    () =>
      api<Page<ApiCustomer>>(
        `/customers?pageSize=50&status=active${term === '' ? '' : `&q=${encodeURIComponent(term)}`}`,
      ),
    [term],
  );

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <View>
        <Text style={type.title}>Customers</Text>
        <Text style={[type.muted, styles.subtitle]}>
          {data === null ? 'Loading' : `${String(data.total)} active`}
        </Text>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.inkMuted} />
        <TextInput
          accessibilityLabel="Search customers"
          placeholder="Search name, email, phone or GSTIN"
          placeholderTextColor="rgba(74,92,120,0.5)"
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
          autoCapitalize="none"
        />
      </View>

      {error !== null && <ErrorBanner message={error} onRetry={reload} />}
      {loading && data === null && <Loading label="Loading customers" />}

      {data !== null && data.items.length === 0 && (
        <Card>
          <EmptyState
            icon="people-outline"
            title={term === '' ? 'No customers yet' : 'No matches'}
            description={
              term === '' ? 'Add the first customer to start invoicing.' : 'Try a different search.'
            }
          />
        </Card>
      )}

      {data !== null && data.items.length > 0 && (
        <View style={styles.list}>
          {data.items.map((customer) => (
            <Pressable
              key={customer.id}
              accessibilityRole="button"
              onPress={() => {
                router.push(`/customers/${customer.id}`);
              }}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{customer.name.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={styles.rowMain}>
                <Text numberOfLines={1} style={styles.rowTitle}>
                  {customer.name}
                </Text>
                <Text numberOfLines={1} style={styles.rowMeta}>
                  {customer.email === '' ? customer.phone : customer.email}
                </Text>
              </View>
              <Badge
                label={customer.status === 'active' ? 'Active' : 'Archived'}
                tone={customer.status === 'active' ? 'green' : 'neutral'}
              />
              <Ionicons name="chevron-forward" size={16} color={colors.inkMuted} />
            </Pressable>
          ))}
        </View>
      )}

      <Button
        label="New customer"
        icon="add"
        onPress={() => {
          router.push('/customers/new');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: 4 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(10,27,53,0.12)',
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, minHeight: 44, fontSize: 14, color: colors.ink },
  list: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowPressed: { backgroundColor: 'rgba(10,27,53,0.03)' },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,102,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.blue, fontWeight: '700' },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 14, fontWeight: '500', color: colors.ink },
  rowMeta: { fontSize: 12, color: colors.inkMuted },
});
