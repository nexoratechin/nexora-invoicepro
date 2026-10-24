import { StyleSheet, Text, View } from 'react-native';
import { formatPaise } from '@nexora/shared';

import { api, type ApiProduct, type Page } from '../src/api';
import { colors, spacing, type } from '../src/theme';
import { Badge, Card, EmptyState, ErrorBanner, Loading, Screen, useFetch } from '../src/ui';

export default function ProductsScreen() {
  const { data, error, loading, reload } = useFetch<Page<ApiProduct>>(
    () => api<Page<ApiProduct>>('/products?pageSize=100&isActive=true'),
    [],
  );

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      {error !== null && <ErrorBanner message={error} onRetry={reload} />}
      {loading && data === null && <Loading label="Loading products" />}

      {data !== null && data.items.length === 0 && (
        <Card>
          <EmptyState
            icon="pricetags-outline"
            title="No products yet"
            description="Add products from the web app, then pick them when raising an invoice here."
          />
        </Card>
      )}

      {data !== null && data.items.length > 0 && (
        <View style={styles.list}>
          {data.items.map((product) => (
            <View key={product.id} style={styles.row}>
              <View style={styles.main}>
                <Text style={styles.name}>{product.name}</Text>
                <Text style={type.muted}>
                  per {product.unitLabel} · {product.taxRateBp / 100}% GST
                </Text>
              </View>
              <View style={styles.right}>
                <Text style={styles.price}>{formatPaise(product.unitPriceMinor)}</Text>
                <Badge
                  label={product.isActive ? 'Active' : 'Inactive'}
                  tone={product.isActive ? 'green' : 'neutral'}
                />
              </View>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.footer}>
        Reading only. Creating and editing products happens in the web app for now.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  main: { flex: 1, gap: 2 },
  name: { fontSize: 14, fontWeight: '500', color: colors.ink },
  right: { alignItems: 'flex-end', gap: 4 },
  price: { fontSize: 14, fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'] },
  footer: { ...type.muted, fontSize: 11, textAlign: 'center' },
});
