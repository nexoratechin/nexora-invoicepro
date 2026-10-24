import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatPaise } from '@nexora/shared';

import { api, type DashboardData } from '../../src/api';
import { useAuth } from '../../src/auth';
import { InvoiceRow } from '../../src/components';
import { colors, spacing, type } from '../../src/theme';
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Loading,
  Screen,
  SectionTitle,
  useFetch,
} from '../../src/ui';

export default function DashboardScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const { data, error, loading, reload } = useFetch<DashboardData>(
    () => api<DashboardData>('/dashboard'),
    [],
  );

  const firstName = session?.user.name.split(' ')[0] ?? 'there';

  if (loading && data === null) {
    return (
      <Screen>
        <Loading label="Loading your dashboard" />
      </Screen>
    );
  }

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <View>
        <Text style={type.title}>Good to see you, {firstName}</Text>
        <Text style={[type.muted, styles.subtitle]}>
          Where the money stands, and what needs chasing.
        </Text>
      </View>

      {error !== null && <ErrorBanner message={error} onRetry={reload} />}

      {data !== null && (
        <>
          <View style={styles.grid}>
            <Stat
              label="Issued"
              value={String(data.counts.total)}
              hint={`${String(data.counts.draft)} draft`}
            />
            <Stat
              label="Paid"
              value={String(data.counts.paid)}
              hint={`${String(data.counts.partial)} part paid`}
            />
            <Stat label="Unpaid" value={String(data.counts.unpaid)} hint="Awaiting payment" />
            <Stat
              label="Overdue"
              value={String(data.counts.overdue)}
              hint={formatPaise(data.revenue.overdueMinor)}
            />
          </View>

          <Card>
            <SectionTitle>Revenue</SectionTitle>
            <Row label="Billed" value={formatPaise(data.revenue.billedMinor)} strong />
            <Row label="Collected" value={formatPaise(data.revenue.collectedMinor)} />
            <Row label="Outstanding" value={formatPaise(data.revenue.outstandingMinor)} />
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${
                      data.revenue.billedMinor === 0
                        ? 0
                        : Math.min(
                            100,
                            Math.round(
                              (data.revenue.collectedMinor / data.revenue.billedMinor) * 100,
                            ),
                          )
                    }%`,
                  },
                ]}
              />
            </View>
            <Text style={type.muted}>
              {data.revenue.billedMinor === 0
                ? 'Nothing billed this month yet.'
                : `${String(
                    Math.round((data.revenue.collectedMinor / data.revenue.billedMinor) * 100),
                  )}% collected this month`}
            </Text>
          </Card>

          <Button
            label="New invoice"
            icon="add"
            onPress={() => {
              router.push('/invoices/new');
            }}
          />

          <SectionTitle>Recent invoices</SectionTitle>

          {data.recentInvoices.length === 0 ? (
            <Card>
              <EmptyState
                title="No invoices yet"
                description="Add a customer, then raise your first invoice. It takes about a minute."
              />
            </Card>
          ) : (
            <View style={styles.list}>
              {data.recentInvoices.map((invoice) => (
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

          {data.overdueInvoices.length > 0 && (
            <>
              <SectionTitle>Needs chasing</SectionTitle>
              <View style={styles.list}>
                {data.overdueInvoices.map((invoice) => (
                  <InvoiceRow
                    key={invoice.id}
                    invoice={invoice}
                    onPress={() => {
                      router.push(`/invoices/${invoice.id}`);
                    }}
                  />
                ))}
              </View>
            </>
          )}
        </>
      )}
    </Screen>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <View style={styles.stat}>
      <Text style={type.label}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statHint}>{hint}</Text>
    </View>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={strong ? type.body : type.muted}>{label}</Text>
      <Text style={strong ? styles.strongValue : styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  stat: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 2,
  },
  statValue: { fontSize: 24, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
  statHint: { fontSize: 12, color: colors.inkMuted },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: 3,
  },
  value: { fontSize: 14, color: colors.ink, fontVariant: ['tabular-nums'] },
  strongValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(10,27,53,0.08)',
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  fill: { height: 8, borderRadius: 999, backgroundColor: colors.cyan },
  list: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
});
