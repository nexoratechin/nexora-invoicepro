import { computeInvoice, formatPaise } from '@nexora/shared';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { API_BASE_URL, fetchHealth, type HealthResponse } from './src/api';
import { colors } from './src/theme';

type ApiState =
  { kind: 'loading' } | { kind: 'ok'; data: HealthResponse } | { kind: 'error'; message: string };

const sample = computeInvoice(
  [
    {
      description: 'Website redesign, 5 pages',
      quantityMilli: 1000,
      unitPriceMinor: 2_500_000,
      taxRateBp: 1800,
    },
  ],
  'intra',
);

export default function App() {
  const [state, setState] = useState<ApiState>({ kind: 'loading' });

  const check = useCallback(async () => {
    setState({ kind: 'loading' });

    try {
      const data = await fetchHealth();
      setState({ kind: 'ok', data });
    } catch (error) {
      setState({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.badgeRow}>
          <View style={styles.badge} />
          <Text style={styles.badgeText}>Stage 2 of 9</Text>
        </View>

        <Text style={styles.title}>Nexora InvoicePro</Text>
        <Text style={styles.tagline}>Innovate | Automate | Transform</Text>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>API status</Text>
            {state.kind === 'loading' ? (
              <ActivityIndicator color={colors.cyan} />
            ) : (
              <Text
                style={[
                  styles.statusText,
                  { color: state.kind === 'ok' ? colors.success : colors.danger },
                ]}
              >
                {state.kind === 'ok' ? 'Connected' : 'Offline'}
              </Text>
            )}
          </View>

          <Text style={styles.mono}>{API_BASE_URL}</Text>

          {state.kind === 'ok' && (
            <View style={styles.factGrid}>
              <Fact label="Service" value={state.data.service} />
              <Fact label="Version" value={state.data.version} />
              <Fact label="Environment" value={state.data.environment} />
              <Fact label="Uptime" value={`${String(state.data.uptimeSeconds)}s`} />
            </View>
          )}

          {state.kind === 'error' && (
            <Text style={styles.bodyText}>
              Not reachable. Start the API with npm run dev:api, then check the URL above.
            </Text>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void check();
            }}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>Check again</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Shared money engine</Text>
          <Text style={styles.bodyText}>
            This screen computes with the same integer-paise functions the API and the web app use.
          </Text>

          <View style={styles.totalsBlock}>
            <TotalRow label="Taxable value" value={formatPaise(sample.totals.taxableTotalMinor)} />
            <TotalRow label="CGST 9%" value={formatPaise(sample.totals.cgstTotalMinor)} />
            <TotalRow label="SGST 9%" value={formatPaise(sample.totals.sgstTotalMinor)} />
            <View style={styles.divider} />
            <TotalRow label="Total" value={formatPaise(sample.totals.totalMinor)} strong />
          </View>
        </View>

        <Text style={styles.footer}>Tax figures are software calculations, not tax advice.</Text>
      </ScrollView>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.totalRow}>
      <Text style={[styles.totalLabel, strong === true && styles.totalLabelStrong]}>{label}</Text>
      <Text style={[styles.totalValue, strong === true && styles.totalValueStrong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 72,
    paddingBottom: 48,
    gap: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.cyan,
  },
  badgeText: {
    color: colors.cyan,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  title: {
    color: colors.white,
    fontSize: 30,
    fontWeight: '700',
  },
  tagline: {
    color: colors.inkMuted,
    fontSize: 13,
    marginTop: -8,
  },
  card: {
    backgroundColor: colors.navySoft,
    borderRadius: 16,
    padding: 18,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  mono: {
    color: colors.inkMuted,
    fontSize: 11,
  },
  bodyText: {
    color: colors.inkMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  factGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 2,
  },
  fact: {
    minWidth: '42%',
  },
  factLabel: {
    color: colors.inkMuted,
    fontSize: 11,
  },
  factValue: {
    color: colors.white,
    fontSize: 13,
    marginTop: 2,
  },
  button: {
    marginTop: 6,
    backgroundColor: colors.blue,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  totalsBlock: {
    marginTop: 4,
    gap: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalLabel: {
    color: colors.inkMuted,
    fontSize: 13,
  },
  totalLabelStrong: {
    color: colors.white,
    fontWeight: '600',
  },
  totalValue: {
    color: colors.white,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  totalValueStrong: {
    fontSize: 15,
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(248,250,255,0.15)',
  },
  footer: {
    color: colors.inkMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
});
